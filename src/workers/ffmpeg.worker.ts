import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

import type { WorkerMessage, WorkerResponse } from "../types";

let ffmpeg: FFmpeg | null = null;

interface TranscodeJob {
  file: File | Blob;
  outputName: string;
  args: string[];
}

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case "LOAD":
        await loadFFmpeg();
        break;
      case "TRANSCODE":
        if (!ffmpeg) throw new Error("FFmpeg not loaded");
        await transcodeVideo(payload as TranscodeJob);
        break;
      case "CANCEL":
        break;
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    postMessage({ type: "ERROR", payload: errorMessage } as WorkerResponse);
  }
};

async function loadFFmpeg() {
  if (ffmpeg) {
    postMessage({ type: "LOADED" } as WorkerResponse);
    return;
  }

  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    postMessage({ type: "LOG", payload: message } as WorkerResponse);
  });

  ffmpeg.on("progress", ({ progress }) => {
    postMessage({
      type: "PROGRESS",
      payload: progress * 100,
    } as WorkerResponse);
  });

  try {
    const baseURL =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm";

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
      workerURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.worker.js`,
        "text/javascript",
      ),
    });

    postMessage({ type: "LOADED" } as WorkerResponse);
  } catch (e: unknown) {
    console.error("FFmpeg load error:", e);
    postMessage({
      type: "ERROR",
      payload: e instanceof Error ? e.message : "Failed to load FFmpeg",
    } as WorkerResponse);
  }
}

async function transcodeVideo(job: TranscodeJob) {
  if (!ffmpeg) return;

  const { file, outputName, args } = job;

  // Write file to FFmpeg FS
  await ffmpeg.writeFile("input.mp4", await fetchFile(file));

  // Run FFmpeg command
  await ffmpeg.exec(args);

  // Read output
  const data = await ffmpeg.readFile(outputName);

  if (typeof data === "string" ? data.length === 0 : data.byteLength === 0) {
    throw new Error("Conversion failed: Output file is empty");
  }

  // Fix type assertion for Blob
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blobData = data as any;
  const blob = new Blob([blobData], { type: "image/gif" });

  postMessage({
    type: "DONE",
    payload: { blob, outputName },
  } as WorkerResponse);

  // Cleanup
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile(outputName);
}

async function fetchFile(file: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function postMessage(response: WorkerResponse) {
  self.postMessage(response);
}
