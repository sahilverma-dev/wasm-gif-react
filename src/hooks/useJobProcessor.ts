import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useJobStore } from "../store/useJobStore";
import { useVideoStore } from "../store/useVideoStore";
import { useLogStore } from "../store/useLogStore";
import { clampRange } from "../lib/video-files";
import { formatBytes } from "../lib/video-utils";
import type {
  GifQuality,
  TranscodePayload,
  WorkerMessage,
  WorkerResponse,
} from "../types";

const STALE_JOB_TIMEOUT_MS = 120_000; // no progress for 2 minutes = stale
const WATCHDOG_INTERVAL_MS = 15_000;

const SAFE_RETRY_SETTINGS = {
  width: 480,
  fps: 15,
  quality: "medium" as GifQuality,
};

function sanitizeFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
  const safe = base.slice(0, 80) || "output";
  return `${safe}.gif`;
}

function clampFps(value: number): number {
  if (!Number.isFinite(value)) return 15;
  return Math.min(60, Math.max(1, Math.round(value)));
}

export function useJobProcessor() {
  const setIsProcessing = useJobStore((state) => state.setProcessing);
  const [isWorkerLoaded, setIsWorkerLoaded] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const activeToastId = useRef<string | number | null>(null);
  const lastProgressTime = useRef<number>(0);
  const workerGeneration = useRef(0);

  const addLog = useLogStore((state) => state.addLog);

  // Re-render only when a job is added or changes status. Progress ticks do
  // not change this signature, so the whole app no longer re-renders per frame.
  const jobQueueKey = useJobStore((state) =>
    state.jobs.map((job) => `${job.id}:${job.status}`).join("|"),
  );
  const videoIdsKey = useVideoStore((state) =>
    state.videos.map((video) => video.id).join("|"),
  );

  const clearActiveToast = useCallback(() => {
    if (activeToastId.current) {
      toast.dismiss(activeToastId.current);
      activeToastId.current = null;
    }
  }, []);

  const markWorkerFailed = useCallback(
    (message: string) => {
      setWorkerError(message);
      setIsWorkerLoaded(false);
      clearActiveToast();
    },
    [clearActiveToast],
  );

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      switch (message.type) {
        case "LOADED":
          setIsWorkerLoaded(true);
          setWorkerError(null);
          addLog("FFmpeg loaded", "info");
          break;

        case "LOG":
          addLog(message.payload, "ffmpeg");
          break;

        case "PROGRESS": {
          // Ignore late events from a job that was cancelled or replaced.
          if (message.jobId !== activeJobIdRef.current) return;

          const progress = Math.max(
            0,
            Math.min(99, Math.round(message.payload)),
          );
          lastProgressTime.current = Date.now();
          useJobStore.getState().updateJobProgress(message.jobId, progress);

          if (activeToastId.current) {
            toast.loading(`Processing: ${progress}%`, {
              id: activeToastId.current,
            });
          }
          break;
        }

        case "DONE": {
          if (message.jobId !== activeJobIdRef.current) return;

          activeJobIdRef.current = null;
          lastProgressTime.current = 0;

          const { blob, outputName } = message.payload;
          const { jobs, completeJob } = useJobStore.getState();
          const job = jobs.find((entry) => entry.id === message.jobId);

          if (job) {
            completeJob(
              job.id,
              URL.createObjectURL(blob),
              formatBytes(blob.size),
            );
            addLog(`Job completed: ${outputName}`, "info");
          }

          if (activeToastId.current) {
            toast.success("Conversion complete", {
              id: activeToastId.current,
            });
            activeToastId.current = null;
          } else {
            toast.success("Conversion complete");
          }
          break;
        }

        case "ERROR": {
          const { jobs, failJob, retryJob } = useJobStore.getState();
          const job = message.jobId
            ? jobs.find((entry) => entry.id === message.jobId)
            : jobs.find((entry) => entry.id === activeJobIdRef.current);

          // A load failure has no owning job: surface the fatal screen instead
          // of silently retrying forever.
          if (message.fatal || !job) {
            addLog(`Fatal worker error: ${message.payload}`, "error");
            markWorkerFailed(message.payload);
            return;
          }

          addLog(`Error: ${message.payload}`, "error");

          const attempt = job.attempt || 1;
          if (attempt < 2) {
            addLog(
              `Job failed (attempt ${attempt}). Retrying with safer settings.`,
              "info",
            );
            retryJob(job.id, SAFE_RETRY_SETTINGS, message.payload);
            activeJobIdRef.current = null;
            lastProgressTime.current = 0;
            if (!activeToastId.current) {
              activeToastId.current = toast.loading(
                `Retrying... (attempt ${attempt + 1})`,
              );
            } else {
              toast.loading(`Retrying... (attempt ${attempt + 1})`, {
                id: activeToastId.current,
              });
            }
            return;
          }

          activeJobIdRef.current = null;
          lastProgressTime.current = 0;
          failJob(job.id, message.payload);
          if (activeToastId.current) {
            // Replace the loading toast in place so the error is not dismissed
            // by the same id in the next line.
            toast.error(`Failed: ${message.payload}`, {
              id: activeToastId.current,
            });
            activeToastId.current = null;
          } else {
            toast.error(`Failed: ${message.payload}`);
          }
          break;
        }
      }
    },
    [addLog, markWorkerFailed],
  );

  const createWorker = useCallback(() => {
    workerGeneration.current += 1;
    const generation = workerGeneration.current;

    workerRef.current?.terminate();
    workerRef.current = null;
    activeJobIdRef.current = null;
    lastProgressTime.current = 0;

    const worker = new Worker(
      new URL("../workers/ffmpeg.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (generation !== workerGeneration.current) return;
      handleWorkerMessage(event);
    };

    worker.onerror = (event) => {
      if (generation !== workerGeneration.current) return;
      const detail = event.message || "The video processor failed to start.";
      addLog(`Worker error: ${detail}`, "error");
      markWorkerFailed(detail);
    };

    worker.postMessage({ type: "LOAD" } satisfies WorkerMessage);
  }, [addLog, handleWorkerMessage, markWorkerFailed]);

  // Boot the worker once and tear it down with the app.
  useEffect(() => {
    createWorker();

    return () => {
      workerGeneration.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
      activeJobIdRef.current = null;
      clearActiveToast();
    };
    // Intentionally mount-only: createWorker only touches refs and stable
    // callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stale-job watchdog. ffmpeg.wasm can freeze on broken input, and
  // ffmpeg.exec() has no cancellation, so the only recovery is a fresh worker.
  useEffect(() => {
    const interval = setInterval(() => {
      const jobId = activeJobIdRef.current;
      if (!jobId) return;

      const elapsed = Date.now() - lastProgressTime.current;
      if (lastProgressTime.current === 0 || elapsed <= STALE_JOB_TIMEOUT_MS) {
        return;
      }

      const { jobs, failJob } = useJobStore.getState();
      const job = jobs.find((entry) => entry.id === jobId);
      if (!job) return;

      addLog(
        `Job "${job.outputFileName}" timed out after ${Math.round(elapsed / 1000)}s without progress.`,
        "error",
      );

      failJob(job.id, "Timed out: the encoder stopped responding.");
      activeJobIdRef.current = null;
      lastProgressTime.current = 0;
      clearActiveToast();
      setIsWorkerLoaded(false);
      createWorker();
      toast.error("Job timed out");
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [addLog, clearActiveToast, createWorker]);

  const handleCancelJob = useCallback(
    (jobId: string) => {
      const job = useJobStore.getState().jobs.find((entry) => entry.id === jobId);
      if (!job) return;

      const wasActive = job.status === "processing";
      useJobStore.getState().cancelJob(jobId);

      if (wasActive) {
        // ffmpeg.exec() cannot be interrupted, so kill the worker and let the
        // queue restart from a clean instance.
        activeJobIdRef.current = null;
        lastProgressTime.current = 0;
        addLog("Cancelled the active job; restarting the encoder.", "info");
        clearActiveToast();
        setIsWorkerLoaded(false);
        createWorker();
      }

      toast.info("Job cancelled");
    },
    [addLog, clearActiveToast, createWorker],
  );

  // Queue runner: starts at most one job at a time.
  useEffect(() => {
    if (!isWorkerLoaded) return;

    const { jobs, startJob, failJob, setProcessing } = useJobStore.getState();

    if (jobs.some((job) => job.status === "processing")) {
      setProcessing(true);
      return;
    }

    const pendingJob = jobs.find((job) => job.status === "pending");
    if (!pendingJob) {
      setProcessing(false);
      return;
    }

    const video = useVideoStore
      .getState()
      .videos.find((entry) => entry.id === pendingJob.videoId);

    if (!video) {
      failJob(pendingJob.id, "The source video is no longer available.");
      setProcessing(false);
      return;
    }

    const trimRange = clampRange(
      pendingJob.trimRange ?? video.trim,
      video.duration,
    );

    if (trimRange.end - trimRange.start < 0.1) {
      failJob(pendingJob.id, "The selected clip is shorter than 0.1s.");
      setProcessing(false);
      return;
    }

    const requestedWidth =
      pendingJob.settings.width === "auto"
        ? video.width
        : Number(pendingJob.settings.width);

    let targetWidth = Number.isFinite(requestedWidth)
      ? Math.max(2, Math.round(requestedWidth))
      : video.width;

    // Never upscale past the source: it wastes encode time and adds no detail.
    if (targetWidth > video.width) {
      addLog(
        `Capping output width to the source (${video.width}px) from ${targetWidth}px.`,
        "info",
      );
      targetWidth = video.width;
    }

    // Even widths keep the lanczos scaler and GIF encoder happy.
    if (targetWidth % 2 !== 0) targetWidth -= 1;
    targetWidth = Math.max(2, targetWidth);

    const fps = clampFps(pendingJob.settings.fps);
    const quality: GifQuality = ["low", "medium", "high"].includes(
      pendingJob.settings.quality,
    )
      ? pendingJob.settings.quality
      : "medium";

    const dither =
      quality === "high"
        ? "sierra2_4a"
        : quality === "low"
          ? "bayer:bayer_scale=3"
          : "bayer:bayer_scale=5";

    const paletteOptions =
      quality === "high" ? "palettegen=stats_mode=diff" : "palettegen";

    const filterComplex = [
      `fps=${fps}`,
      `scale=${targetWidth}:-2:flags=lanczos`,
      `split[s0][s1];[s0]${paletteOptions}[p];[s1][p]paletteuse=dither=${dither}`,
    ].join(",");

    const extension = video.file.name.split(".").pop()?.toLowerCase() || "mp4";
    const inputName = `input.${extension.replace(/[^\w]/g, "") || "mp4"}`;
    const outputName = sanitizeFileName(pendingJob.outputFileName);

    const args = [
      "-ss",
      trimRange.start.toFixed(3),
      "-t",
      (trimRange.end - trimRange.start).toFixed(3),
      "-i",
      inputName,
      "-an",
      "-filter_complex",
      filterComplex,
      "-loop",
      "0",
      "-f",
      "gif",
      outputName,
    ];

    startJob(pendingJob.id);
    setProcessing(true);
    activeJobIdRef.current = pendingJob.id;
    lastProgressTime.current = Date.now();

    if (!activeToastId.current) {
      activeToastId.current = toast.loading("Processing: 0%");
    }

    const payload: TranscodePayload = {
      jobId: pendingJob.id,
      file: video.file,
      inputName,
      outputName,
      args,
    };

    const worker = workerRef.current;
    if (!worker) {
      activeJobIdRef.current = null;
      lastProgressTime.current = 0;
      failJob(pendingJob.id, "The video engine is not available. Reload the page.");
      setProcessing(false);
      return;
    }

    worker.postMessage({
      type: "TRANSCODE",
      payload,
    } satisfies WorkerMessage);
  }, [isWorkerLoaded, jobQueueKey, videoIdsKey, addLog]);

  // Keep the footprint honest: one processing job means one encoder.
  useEffect(() => {
    if (workerError) {
      setIsProcessing(false);
    }
  }, [workerError, setIsProcessing]);

  return { workerError, isWorkerLoaded, handleCancelJob };
}
