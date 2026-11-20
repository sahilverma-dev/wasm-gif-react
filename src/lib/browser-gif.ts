import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { GifQuality, GifSettings, VideoFile } from "../types";
import { clampRange, type TimeRange } from "./video-files";

interface BrowserEncodeOptions {
  video: VideoFile;
  trimRange: TimeRange;
  settings: GifSettings;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
}

const PALETTE_SAMPLES = 9;
const PALETTE_CELL = 160;
const PALETTE_FORMAT = "rgb565" as const;
const SEEK_TIMEOUT_MS = 15_000;

const COLORS_BY_QUALITY: Record<GifQuality, number> = {
  low: 64,
  medium: 160,
  high: 256,
};

/**
 * Encodes a GIF with the browser's own decoder and `gifenc`.
 *
 * No WebAssembly and no download: frames are read by seeking a `<video>`
 * element, drawn to a canvas and quantized to one shared palette sampled from
 * the clip. This is slower than FFmpeg's two-pass palette on long clips, but it
 * has a much smaller memory footprint and starts instantly.
 */
export async function encodeGifInBrowser({
  video: source,
  trimRange,
  settings,
  signal,
  onProgress,
}: BrowserEncodeOptions): Promise<Blob> {
  const range = clampRange(trimRange, source.duration);
  const video = await createVideoElement(source.blobUrl, signal);

  try {
    const sourceWidth = video.videoWidth || source.width;
    const sourceHeight = video.videoHeight || source.height;

    const requestedWidth =
      settings.width === "auto" ? sourceWidth : Number(settings.width);
    const width = even(
      Math.max(2, Math.min(
        Number.isFinite(requestedWidth) ? Math.round(requestedWidth) : sourceWidth,
        sourceWidth,
      )),
    );
    const height = even(
      Math.max(2, Math.round((width * sourceHeight) / sourceWidth)),
    );

    const fps = clampFps(settings.fps);
    const frameCount = Math.max(1, Math.floor((range.end - range.start) * fps));
    const frameDelay = Math.max(20, Math.round(100 / fps) * 10);
    const colors = COLORS_BY_QUALITY[settings.quality] ?? 160;

    onProgress(1);

    const palette = await buildPalette(
      video,
      range,
      colors,
      signal,
      (progress) => onProgress(1 + progress * 8),
    );

    onProgress(9);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("The browser could not create a drawing surface.");
    }

    const gif = GIFEncoder();
    let lastReported = -1;

    for (let index = 0; index < frameCount; index += 1) {
      throwIfAborted(signal);

      const time = Math.min(
        range.start + index / fps,
        Math.max(range.start, range.end - 0.001),
      );

      await seekVideo(video, time, signal);
      context.drawImage(video, 0, 0, width, height);

      const { data } = context.getImageData(0, 0, width, height);
      const indexed = applyPalette(data, palette, PALETTE_FORMAT);

      gif.writeFrame(
        indexed,
        width,
        height,
        index === 0
          ? { palette, delay: frameDelay, repeat: 0 }
          : { delay: frameDelay },
      );

      const progress = 9 + ((index + 1) / frameCount) * 90;
      if (progress - lastReported >= 1 || index === frameCount - 1) {
        lastReported = progress;
        onProgress(progress);
      }
    }

    gif.finish();
    onProgress(100);

    return new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}

async function buildPalette(
  video: HTMLVideoElement,
  range: TimeRange,
  colors: number,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<number[][]> {
  const grid = Math.ceil(Math.sqrt(PALETTE_SAMPLES));
  const canvas = document.createElement("canvas");
  canvas.width = grid * PALETTE_CELL;
  canvas.height = grid * PALETTE_CELL;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("The browser could not create a drawing surface.");
  }

  // Fill with black so unused cells do not skew the palette.
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const span = Math.max(0, range.end - range.start);

  for (let index = 0; index < PALETTE_SAMPLES; index += 1) {
    throwIfAborted(signal);

    const ratio = index / (PALETTE_SAMPLES - 1);
    const time = Math.min(
      range.start + ratio * span,
      Math.max(range.start, range.end - 0.001),
    );

    await seekVideo(video, time, signal);

    const col = index % grid;
    const row = Math.floor(index / grid);
    context.drawImage(
      video,
      col * PALETTE_CELL,
      row * PALETTE_CELL,
      PALETTE_CELL,
      PALETTE_CELL,
    );

    onProgress((index + 1) / PALETTE_SAMPLES);
  }

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return quantize(data, colors, { format: PALETTE_FORMAT });
}

async function createVideoElement(
  src: string,
  signal: AbortSignal,
): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  video.style.cssText =
    "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";

  document.body.appendChild(video);

  try {
    const metadata = waitForEvent(video, "loadedmetadata", signal);
    video.src = src;
    await metadata;

    if (video.readyState < 2) {
      await waitForEvent(video, "loadeddata", signal);
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("The browser could not read this video's duration.");
    }

    return video;
  } catch (error) {
    video.removeAttribute("src");
    video.load();
    video.remove();
    throw error;
  }
}

function waitForEvent(
  target: HTMLVideoElement,
  eventName: "loadedmetadata" | "loadeddata",
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const timers: { id?: ReturnType<typeof setTimeout> } = {};

    const cleanup = () => {
      if (timers.id) clearTimeout(timers.id);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const settle = (callback: () => void) => {
      cleanup();
      callback();
    };

    const onEvent = () => settle(resolve);
    const onError = () =>
      settle(() => reject(new Error("The browser could not decode the video.")));
    const onAbort = () => settle(() => reject(abortError()));

    target.addEventListener(eventName, onEvent);
    target.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);

    timers.id = setTimeout(
      () =>
        settle(() =>
          reject(new Error("Timed out while reading the video in the browser.")),
        ),
      SEEK_TIMEOUT_MS,
    );
  });
}

async function seekVideo(
  video: HTMLVideoElement,
  time: number,
  signal: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);

  const target = Math.max(
    0,
    Math.min(time, Math.max(0, video.duration - 0.001)),
  );

  if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.002) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const timers: { id?: ReturnType<typeof setTimeout> } = {};

    const cleanup = () => {
      if (timers.id) clearTimeout(timers.id);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const settle = (callback: () => void) => {
      cleanup();
      callback();
    };

    const onSeeked = () => settle(resolve);
    const onError = () =>
      settle(() =>
        reject(new Error("The browser could not decode this video frame.")),
      );
    const onAbort = () => settle(() => reject(abortError()));

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);

    timers.id = setTimeout(
      () =>
        settle(() =>
          reject(new Error("Timed out while reading a video frame.")),
        ),
      SEEK_TIMEOUT_MS,
    );

    try {
      video.currentTime = target;
    } catch (error) {
      settle(() =>
        reject(
          error instanceof Error
            ? error
            : new Error("The browser rejected a video seek."),
        ),
      );
    }
  });
}

function clampFps(value: number): number {
  if (!Number.isFinite(value)) return 15;
  return Math.min(60, Math.max(1, Math.round(value)));
}

function even(value: number): number {
  return value % 2 === 0 ? value : value - 1;
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("Encoding cancelled.", "AbortError");
}
