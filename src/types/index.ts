export interface VideoFile {
  id: string;
  file: File;
  blobUrl: string;
  duration: number;
  width: number;
  height: number;
  trim: {
    start: number;
    end: number;
  };
  thumbnailUrl?: string;
  clips: VideoClip[];
}

export interface VideoClip {
  id: string;
  start: number;
  end: number;
  label?: string;
}

export type GifQuality = "low" | "medium" | "high";

export interface GifSettings {
  width: number | "auto"; // 'auto' uses original width
  fps: number;
  quality: GifQuality;
}

export interface ProcessingJob {
  id: string;
  videoId: string;
  clipId?: string; // If processing a specific clip
  status: "pending" | "processing" | "completed" | "error" | "cancelled";
  progress: number; // 0-100
  resultUrl?: string; // Blob URL of the generated GIF
  error?: string;
  settings: GifSettings;
  outputFileName: string;
  trimRange?: {
    start: number;
    end: number;
  };
}

export interface WorkerMessage {
  type: "LOAD" | "TRANSCODE" | "CANCEL";
  payload?: unknown;
}

export interface WorkerResponse {
  type: "LOADED" | "PROGRESS" | "DONE" | "ERROR" | "LOG";
  payload?: unknown;
}
