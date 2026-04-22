export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

const MAX_THUMBNAIL_WIDTH = 480;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Reads duration, dimensions and a poster frame from a local file.
 *
 * Every failure path revokes the temporary object URL, and the promise always
 * settles within the timeout so a corrupt file cannot leave the uploader
 * hanging forever.
 */
export function getMetadata(
  file: File,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("video/")) {
      reject(new Error("This file is not a video."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const timers: {
      overall?: ReturnType<typeof setTimeout>;
      seek?: ReturnType<typeof setTimeout>;
    } = {};

    const cleanup = () => {
      if (timers.overall) clearTimeout(timers.overall);
      if (timers.seek) clearTimeout(timers.seek);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const succeed = (metadata: VideoMetadata) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(metadata);
    };

    timers.overall = setTimeout(
      () => fail("Timed out while reading the video."),
      timeoutMs,
    );

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => fail("Failed to load the video.");

    video.onloadedmetadata = () => {
      const { duration, videoWidth, videoHeight } = video;

      if (!Number.isFinite(duration) || duration <= 0) {
        fail("The video duration could not be determined.");
        return;
      }
      if (!videoWidth || !videoHeight) {
        fail("The video has no readable video track.");
        return;
      }

      const metadata: VideoMetadata = {
        duration,
        width: videoWidth,
        height: videoHeight,
      };

      // Seek a little into the file so a black first frame is avoided.
      video.onseeked = () => {
        const thumbnailUrl = captureThumbnail(video);
        succeed(thumbnailUrl ? { ...metadata, thumbnailUrl } : metadata);
      };

      // Some codecs never fire `seeked`. Rather than reject a valid file after
      // the full timeout, grab whatever frame is decoded and move on.
      timers.seek = setTimeout(() => {
        const thumbnailUrl = captureThumbnail(video);
        succeed(thumbnailUrl ? { ...metadata, thumbnailUrl } : metadata);
      }, 2_000);

      try {
        video.currentTime = Math.min(0.5, duration * 0.1);
      } catch {
        // Some codecs refuse the seek; fall back to the current frame.
        const thumbnailUrl = captureThumbnail(video);
        succeed(thumbnailUrl ? { ...metadata, thumbnailUrl } : metadata);
      }
    };

    video.src = objectUrl;
  });
}

function captureThumbnail(video: HTMLVideoElement): string | undefined {
  try {
    const scale = Math.min(1, MAX_THUMBNAIL_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // toBlob is asynchronous, but the data URL is available synchronously and
    // thumbnails are small enough that this is cheap.
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    // A tainted canvas or an unsupported codec must not reject the upload.
    return undefined;
  }
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
