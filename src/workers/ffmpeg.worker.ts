import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

import type {
  TranscodePayload,
  WorkerMessage,
  WorkerResponse,
} from "../types";

// Multi-threaded core is required for reasonable encoding speeds. It is
// fetched at runtime because the wasm binary is far too large to bundle.
const CORE_VERSION = "0.12.10";
const CORE_CDNS = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`,
];

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;
let activeJobId: string | null = null;
// Progress is reported per pass; these map it onto one 0-99 job bar.
let progressOffset = 0;
let progressScale = 1;

// Handle messages from the main thread. Jobs are serialized: the main thread
// can post the next job the moment DONE arrives, and without this queue that
// job would race the previous job's filesystem cleanup.
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  queue = queue
    .then(() => handleMessage(event.data))
    .catch((error: unknown) => {
      post({
        type: "ERROR",
        payload:
          error instanceof Error ? error.message : "Unknown worker error.",
      });
    });
};

async function handleMessage(message: WorkerMessage): Promise<void> {
  switch (message.type) {
    case "LOAD":
      await loadFFmpeg();
      break;
    case "TRANSCODE":
      if (!ffmpeg) {
        // The main thread normally waits for LOADED, but a freshly restarted
        // worker can still receive a job first.
        await loadFFmpeg();
        if (!ffmpeg) return;
      }
      await transcodeVideo(message.payload);
      break;
    case "CANCEL":
      // ffmpeg.exec() cannot be interrupted from inside the worker. The main
      // thread terminates the worker to cancel, so there is nothing to do here.
      break;
  }
}

async function loadFFmpeg(): Promise<void> {
  if (ffmpeg) {
    post({ type: "LOADED" });
    return;
  }

  // Reuse an in-flight load (StrictMode mounts the worker once, but a retry
  // could still race a previous attempt).
  if (!loadPromise) {
    loadPromise = loadCore().finally(() => {
      loadPromise = null;
    });
  }

  try {
    await loadPromise;
  } catch (error) {
    ffmpeg = null;
    post({
      type: "ERROR",
      payload: error instanceof Error ? error.message : "Failed to load FFmpeg",
      fatal: true,
    });
  }
}

async function loadCore(): Promise<void> {
  if (typeof SharedArrayBuffer === "undefined" || !self.crossOriginIsolated) {
    throw new Error(
      "SharedArrayBuffer is unavailable. The page must be served with Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp.",
    );
  }

  let lastError: unknown = null;

  for (const baseURL of CORE_CDNS) {
    // A failed load can leave an instance half-initialised, so each mirror
    // gets a fresh FFmpeg object.
    const instance = new FFmpeg();

    instance.on("log", ({ message }) => {
      post({ type: "LOG", payload: message });
    });

    instance.on("progress", ({ progress }) => {
      if (!activeJobId) return;
      const overall = progressOffset + progress * progressScale;
      const percent = Math.max(0, Math.min(99, Math.round(overall * 100)));
      post({ type: "PROGRESS", jobId: activeJobId, payload: percent });
    });

    try {
      await instance.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript",
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
        workerURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.worker.js`,
          "text/javascript",
        ),
      });

      ffmpeg = instance;
      post({ type: "LOADED" });
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to load FFmpeg core from ${baseURL}`, error);
      try {
        instance.terminate();
      } catch {
        // Nothing to release if the instance never started.
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to download the FFmpeg core from every mirror.");
}

async function transcodeVideo(job: TranscodePayload): Promise<void> {
  if (!ffmpeg) return;
  if (activeJobId) {
    post({
      type: "ERROR",
      jobId: job.jobId,
      payload: "The video processor is busy with another job.",
    });
    return;
  }

  const { jobId, file, inputName, outputName, args, palette } = job;
  activeJobId = jobId;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    if (palette) {
      // Two-pass palette: the first pass only accumulates colour statistics,
      // so memory stays bounded. The old single-pass split buffered every
      // decoded frame until the palette was ready and OOMed on long clips.
      progressOffset = 0;
      progressScale = 0.4;

      post({ type: "LOG", payload: "Pass 1/2: building the colour palette…" });
      const paletteExitCode = await ffmpeg.exec(palette.args);
      if (paletteExitCode !== 0) {
        throw new Error(
          `Palette generation failed with code ${paletteExitCode}.`,
        );
      }

      const paletteData = await ffmpeg.readFile(palette.outputName);
      const paletteSize =
        typeof paletteData === "string"
          ? paletteData.length
          : paletteData.byteLength;
      if (paletteSize === 0) {
        throw new Error("Palette generation produced an empty image.");
      }

      progressOffset = 0.4;
      progressScale = 0.6;
      post({ type: "LOG", payload: "Pass 2/2: encoding the GIF…" });
    } else {
      progressOffset = 0;
      progressScale = 1;
    }

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}.`);
    }

    const data = await ffmpeg.readFile(outputName);
    const size = typeof data === "string" ? data.length : data.byteLength;

    if (size === 0) {
      throw new Error("Conversion failed: the output GIF is empty.");
    }

    const blob = new Blob([data as BlobPart], { type: "image/gif" });
    post({ type: "DONE", jobId, payload: { blob, outputName } });
  } catch (error) {
    post({
      type: "ERROR",
      jobId,
      payload: error instanceof Error ? error.message : "Conversion failed.",
    });
  } finally {
    activeJobId = null;
    progressOffset = 0;
    progressScale = 1;

    // Always clear the virtual filesystem, even when encoding failed.
    const createdFiles = [inputName, outputName];
    if (palette) createdFiles.push(palette.outputName);

    for (const name of createdFiles) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        // The file may never have been created; nothing to clean up.
      }
    }
  }
}

async function fetchFile(file: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function post(response: WorkerResponse) {
  self.postMessage(response);
}
