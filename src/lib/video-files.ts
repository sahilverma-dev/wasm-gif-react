import { v4 as uuidv4 } from "uuid";
import type { VideoFile } from "../types";
import { createObjectUrl } from "./blob";
import { formatBytes, formatClock, getMetadata } from "./video-utils";

export const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
export const DEFAULT_MAX_DURATION_SECONDS = 60;
export const DEFAULT_MAX_FILES = 10;

interface BuildVideosOptions {
  removeLimits: boolean;
  /** Files already in the workspace, used to avoid duplicates. */
  existing?: VideoFile[];
  maxFiles?: number;
}

export interface BuildVideosResult {
  videos: VideoFile[];
  errors: string[];
}

function fingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Validates and converts dropped files into workspace entries. This is shared
 * by the empty-state uploader and the "add more" tile so both paths enforce the
 * same limits and duplicate rules.
 */
export async function buildVideos(
  files: File[],
  { removeLimits, existing = [], maxFiles }: BuildVideosOptions,
): Promise<BuildVideosResult> {
  const videos: VideoFile[] = [];
  const errors: string[] = [];
  const known = new Set(existing.map((video) => fingerprint(video.file)));
  const limit = removeLimits ? Infinity : (maxFiles ?? DEFAULT_MAX_FILES);

  let remaining = Math.max(0, limit - existing.length);

  if (remaining === 0) {
    return {
      videos,
      errors: [`You can add up to ${limit} videos at a time.`],
    };
  }

  for (const file of files) {
    if (remaining === 0) {
      errors.push(`Extra files were skipped (max ${limit}).`);
      break;
    }

    if (known.has(fingerprint(file))) {
      errors.push(`${file.name}: Already added.`);
      continue;
    }

    if (!removeLimits && file.size > DEFAULT_MAX_FILE_BYTES) {
      errors.push(
        `${file.name}: Too large (${formatBytes(file.size)}, max ${formatBytes(DEFAULT_MAX_FILE_BYTES)}).`,
      );
      continue;
    }

    try {
      const metadata = await getMetadata(file);

      if (!removeLimits && metadata.duration > DEFAULT_MAX_DURATION_SECONDS) {
        errors.push(
          `${file.name}: Too long (${formatClock(metadata.duration)}, max ${formatClock(DEFAULT_MAX_DURATION_SECONDS)}).`,
        );
        continue;
      }

      known.add(fingerprint(file));
      remaining -= 1;
      videos.push({
        id: uuidv4(),
        file,
        blobUrl: createObjectUrl(file),
        ...metadata,
        trim: { start: 0, end: metadata.duration },
        clips: [],
      });
    } catch (error) {
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : "Failed to load video"}`,
      );
    }
  }

  return { videos, errors };
}

export interface TimeRange {
  start: number;
  end: number;
}

/** Guarantees a usable range inside the source duration. */
export function clampRange(range: TimeRange, duration: number): TimeRange {
  const safeDuration = Math.max(0.1, Number.isFinite(duration) ? duration : 0);
  const start = Math.min(
    Math.max(0, Number.isFinite(range.start) ? range.start : 0),
    safeDuration - 0.1,
  );
  const end = Math.min(
    Math.max(start + 0.1, Number.isFinite(range.end) ? range.end : safeDuration),
    safeDuration,
  );

  return { start, end };
}
