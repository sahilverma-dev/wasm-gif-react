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

  ffmpeg.on("log", () => {
    // console.log(message);
    // postMessage({ type: 'LOG', payload: message } as WorkerResponse);
  });

  ffmpeg.on("progress", ({ progress }) => {
    postMessage({
      type: "PROGRESS",
      payload: progress * 100,
    } as WorkerResponse);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  postMessage({ type: "LOADED" } as WorkerResponse);
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

  // Fix type assertion for Blob
  const blobData = data as Uint8Array;
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
