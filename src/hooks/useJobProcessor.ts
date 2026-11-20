import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useJobStore } from "../store/useJobStore";
import { useVideoStore } from "../store/useVideoStore";
import { useLogStore } from "../store/useLogStore";
import { encodeGifInBrowser } from "../lib/browser-gif";
import { clampRange, type TimeRange } from "../lib/video-files";
import { formatBytes } from "../lib/video-utils";
import type {
  EncoderEngine,
  GifQuality,
  ProcessingJob,
  TranscodePayload,
  VideoFile,
  WorkerMessage,
  WorkerResponse,
} from "../types";

const STALE_JOB_TIMEOUT_MS = 120_000; // no progress for 2 minutes = stale
const WATCHDOG_INTERVAL_MS = 15_000;

// A single-pass palette buffers the whole decoded clip in memory. Above this
// budget we use a two-pass palette instead (slower, bounded memory). Phones and
// low-memory devices get a tighter budget.
function getFrameBufferBudget(): number {
  if (typeof window === "undefined") return 192 * 1024 * 1024;

  const coarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const deviceMemory = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  const lowMemory = coarsePointer || (deviceMemory ?? 8) <= 4;

  return (lowMemory ? 128 : 192) * 1024 * 1024;
}

const TWO_PASS_THRESHOLD_BYTES = getFrameBufferBudget();

// FFmpeg.wasm leaves the whole runtime unusable after these errors, so the
// job must be retried on a fresh worker instead of the same instance.
const RUNTIME_CRASH =
  /aborted|oom|out of memory|runtimeerror|memory access|exited with code -1/i;

// Each retry is materially lighter than the last. A job only gives up after
// every rung has been tried on a fresh encoder.
const RETRY_LADDER: Array<{
  width: number;
  fps: number;
  quality: GifQuality;
}> = [
  { width: 480, fps: 12, quality: "medium" },
  { width: 360, fps: 10, quality: "low" },
];

function resolveEngine(job: ProcessingJob): EncoderEngine {
  return job.settings.engine ?? "ffmpeg";
}

function describeFailure(message: string): string {
  if (RUNTIME_CRASH.test(message)) {
    return "The encoder ran out of memory. Try a smaller resolution, a lower frame rate, or a shorter selection.";
  }
  return message;
}

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
  const [isEngineLoading, setIsEngineLoading] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const activeJobNeedsRestartRef = useRef(false);
  const restartingRef = useRef(false);
  const browserAbortRef = useRef<AbortController | null>(null);
  const browserRunningRef = useRef(false);
  const activeToastId = useRef<string | number | null>(null);
  const lastProgressTime = useRef<number>(0);
  const workerGeneration = useRef(0);
  const [workerRestarts, setWorkerRestarts] = useState(0);
  const [queueTick, setQueueTick] = useState(0);

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
      setIsEngineLoading(false);
      restartingRef.current = false;
      clearActiveToast();
    },
    [clearActiveToast],
  );

  // Shared failure handling for both engines: retry a lighter attempt and only
  // restart the FFmpeg worker when the wasm runtime is actually broken.
  const finishJobWithError = useCallback(
    (jobId: string, rawMessage: string) => {
      const { jobs, failJob, retryJob } = useJobStore.getState();
      const job = jobs.find((entry) => entry.id === jobId);
      if (!job) return;

      addLog(`Error: ${rawMessage}`, "error");

      const engine = resolveEngine(job);
      const crashed = engine === "ffmpeg" && RUNTIME_CRASH.test(rawMessage);
      const needsRestart =
        engine === "ffmpeg" && activeJobNeedsRestartRef.current;
      activeJobNeedsRestartRef.current = false;
      const shouldRestart = crashed || needsRestart;
      const reason = describeFailure(rawMessage);
      const attempt = job.attempt || 1;
      const retrySettings = RETRY_LADDER[attempt - 1];

      activeJobIdRef.current = null;
      lastProgressTime.current = 0;

      if (retrySettings) {
        addLog(
          `Job failed (attempt ${attempt}). Retrying at ${retrySettings.width}px / ${retrySettings.fps}fps.`,
          "info",
        );
        retryJob(job.id, { ...job.settings, ...retrySettings }, reason);
        if (shouldRestart) {
          restartingRef.current = true;
          setIsWorkerLoaded(false);
          setWorkerRestarts((count) => count + 1);
        }
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

      failJob(job.id, reason);
      if (shouldRestart) {
        restartingRef.current = true;
        setIsWorkerLoaded(false);
        setWorkerRestarts((count) => count + 1);
      }
      if (activeToastId.current) {
        // Replace the loading toast in place so the error is not dismissed by
        // the same id in the next line.
        toast.error(`Failed: ${reason}`, {
          id: activeToastId.current,
        });
        activeToastId.current = null;
      } else {
        toast.error(`Failed: ${reason}`);
      }
    },
    [addLog],
  );

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      switch (message.type) {
        case "LOADED":
          setIsWorkerLoaded(true);
          setIsEngineLoading(false);
          restartingRef.current = false;
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

          const needsRestart = activeJobNeedsRestartRef.current;
          activeJobNeedsRestartRef.current = false;

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

          // A two-pass job leaves this wasm build's runtime in a state where
          // the next exec hangs, so the encoder is recycled before the queue
          // moves on.
          if (needsRestart) {
            restartingRef.current = true;
            setIsWorkerLoaded(false);
            setWorkerRestarts((count) => count + 1);
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
          const { jobs } = useJobStore.getState();
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

          finishJobWithError(job.id, message.payload);
          break;
        }
      }
    },
    [addLog, finishJobWithError, markWorkerFailed],
  );

  const createWorker = useCallback(() => {
    workerGeneration.current += 1;
    const generation = workerGeneration.current;

    workerRef.current?.terminate();
    workerRef.current = null;
    activeJobIdRef.current = null;
    activeJobNeedsRestartRef.current = false;
    restartingRef.current = true;
    lastProgressTime.current = 0;
    setIsEngineLoading(true);

    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../workers/ffmpeg.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (error) {
      markWorkerFailed(
        error instanceof Error
          ? error.message
          : "Failed to start the FFmpeg worker.",
      );
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (generation !== workerGeneration.current) return;
      handleWorkerMessage(event);
    };

    worker.onerror = (event) => {
      if (generation !== workerGeneration.current) return;
      const detail = event.message || "The video processor failed to start.";
      addLog(`Worker error: ${detail}`, "error");

      const activeId = activeJobIdRef.current;
      const { jobs } = useJobStore.getState();
      const job = activeId
        ? jobs.find((entry) => entry.id === activeId)
        : undefined;

      // A crash while an FFmpeg job is running is recoverable: retry it on a
      // fresh worker. If the active job uses the browser engine, leave it
      // alone and just discard the idle worker.
      if (job && resolveEngine(job) === "ffmpeg") {
        finishJobWithError(job.id, detail);
        setIsWorkerLoaded(false);
        setWorkerRestarts((count) => count + 1);
        return;
      }

      if (job) {
        addLog(
          "The idle FFmpeg worker crashed; the browser encoder is unaffected.",
          "error",
        );
        workerRef.current = null;
        setIsWorkerLoaded(false);
        setIsEngineLoading(false);
        return;
      }

      markWorkerFailed(detail);
    };

    worker.postMessage({ type: "LOAD" } satisfies WorkerMessage);
  }, [
    addLog,
    handleWorkerMessage,
    finishJobWithError,
    markWorkerFailed,
  ]);

  // Restart the encoder after a wasm crash. Reusing a crashed instance makes
  // every later exec hang with no progress.
  useEffect(() => {
    if (workerRestarts === 0) return;
    createWorker();
  }, [workerRestarts, createWorker]);

  // Tear down both engines with the app. FFmpeg is not created until an FFmpeg
  // job actually needs it, so the browser engine never downloads it.
  useEffect(() => {
    return () => {
      workerGeneration.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
      browserAbortRef.current?.abort();
      clearActiveToast();
    };
  }, [clearActiveToast]);

  const startBrowserJob = useCallback(
    (job: ProcessingJob, video: VideoFile, trimRange: TimeRange) => {
      const controller = new AbortController();
      browserAbortRef.current = controller;
      browserRunningRef.current = true;
      activeJobIdRef.current = job.id;
      activeJobNeedsRestartRef.current = false;
      lastProgressTime.current = Date.now();

      const { startJob, setProcessing } = useJobStore.getState();
      startJob(job.id);
      setProcessing(true);

      if (!activeToastId.current) {
        activeToastId.current = toast.loading("Processing: 0%");
      }

      void (async () => {
        try {
          const blob = await encodeGifInBrowser({
            video,
            trimRange,
            settings: job.settings,
            signal: controller.signal,
            onProgress: (progress) => {
              lastProgressTime.current = Date.now();
              const percent = Math.max(
                0,
                Math.min(99, Math.round(progress)),
              );
              useJobStore.getState().updateJobProgress(job.id, percent);
              if (activeToastId.current) {
                toast.loading(`Processing: ${percent}%`, {
                  id: activeToastId.current,
                });
              }
            },
          });

          if (controller.signal.aborted) return;

          useJobStore
            .getState()
            .completeJob(
              job.id,
              URL.createObjectURL(blob),
              formatBytes(blob.size),
            );
          activeJobIdRef.current = null;
          lastProgressTime.current = 0;
          addLog(`Job completed: ${job.outputFileName}`, "info");

          if (activeToastId.current) {
            toast.success("Conversion complete", {
              id: activeToastId.current,
            });
            activeToastId.current = null;
          } else {
            toast.success("Conversion complete");
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          finishJobWithError(
            job.id,
            error instanceof Error ? error.message : "Browser encoding failed.",
          );
        } finally {
          browserRunningRef.current = false;
          browserAbortRef.current = null;
          if (activeJobIdRef.current === job.id) {
            activeJobIdRef.current = null;
          }
          setQueueTick((count) => count + 1);
        }
      })();
    },
    [addLog, finishJobWithError],
  );

  // Stale-job watchdog. FFmpeg has no cancellation and can freeze on broken
  // input; the browser engine can be aborted directly.
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

      if (resolveEngine(job) === "browser") {
        browserAbortRef.current?.abort();
        failJob(job.id, "Timed out: the browser encoder stopped responding.");
        activeJobIdRef.current = null;
        lastProgressTime.current = 0;
        clearActiveToast();
        setQueueTick((count) => count + 1);
        toast.error("Job timed out");
        return;
      }

      failJob(job.id, "Timed out: the encoder stopped responding.");
      activeJobIdRef.current = null;
      activeJobNeedsRestartRef.current = false;
      lastProgressTime.current = 0;
      clearActiveToast();
      restartingRef.current = true;
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

      if (wasActive && resolveEngine(job) === "browser") {
        browserAbortRef.current?.abort();
        activeJobIdRef.current = null;
        lastProgressTime.current = 0;
        clearActiveToast();
        toast.info("Job cancelled");
        setQueueTick((count) => count + 1);
        return;
      }

      if (wasActive) {
        // ffmpeg.exec() cannot be interrupted, so kill the worker and let the
        // queue restart from a clean instance.
        activeJobIdRef.current = null;
        activeJobNeedsRestartRef.current = false;
        lastProgressTime.current = 0;
        addLog("Cancelled the active job; restarting the encoder.", "info");
        clearActiveToast();
        restartingRef.current = true;
        setIsWorkerLoaded(false);
        createWorker();
      }

      toast.info("Job cancelled");
    },
    [addLog, clearActiveToast, createWorker],
  );

  // Queue runner: starts at most one job at a time.
  useEffect(() => {
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

    if (resolveEngine(pendingJob) === "browser") {
      if (browserRunningRef.current) return;
      startBrowserJob(pendingJob, video, trimRange);
      return;
    }

    // The FFmpeg engine is created on first use so the browser path never
    // downloads the 30 MB core.
    if (!isWorkerLoaded || restartingRef.current) {
      if (!workerRef.current) createWorker();
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

    const paletteStats = quality === "high" ? "=stats_mode=diff" : "";

    const extension = video.file.name.split(".").pop()?.toLowerCase() || "mp4";
    const inputName = `input.${extension.replace(/[^\w]/g, "") || "mp4"}`;
    const outputName = sanitizeFileName(pendingJob.outputFileName);
    const paletteName = "palette.bmp";

    const targetHeight = Math.max(
      2,
      Math.round((targetWidth * video.height) / video.width / 2) * 2,
    );
    const frameCount = Math.ceil((trimRange.end - trimRange.start) * fps);
    // A roughly 4-bytes-per-pixel frame buffer. Single-pass palette encoding
    // keeps every frame until palettegen finishes, so large clips must use the
    // two-pass path to stay inside the wasm heap.
    const bufferedBytes = frameCount * targetWidth * targetHeight * 4;
    const useTwoPass = bufferedBytes > TWO_PASS_THRESHOLD_BYTES;
    activeJobNeedsRestartRef.current = useTwoPass;

    if (useTwoPass) {
      addLog(
        `Large clip (${Math.round(bufferedBytes / (1024 * 1024))} MB frame buffer): using low-memory two-pass palette encoding.`,
        "info",
      );
    }

    const seekArgs = [
      "-y",
      "-ss",
      trimRange.start.toFixed(3),
      "-t",
      (trimRange.end - trimRange.start).toFixed(3),
    ];

    // Pass 1 only accumulates colour statistics, which keeps memory bounded.
    // Do not cap frames here: palettegen emits its single frame at EOF, and
    // stopping the muxer early deadlocks the wasm pipeline. BMP avoids a
    // PNG-muxer deadlock in this ffmpeg.wasm build.
    const paletteArgs = [
      ...seekArgs,
      "-i",
      inputName,
      "-an",
      "-vf",
      `fps=${fps},scale=${targetWidth}:-2:flags=lanczos,palettegen${paletteStats}`,
      paletteName,
    ];

    // Pass 2 streams the palette over the clip instead of buffering every
    // decoded frame.
    const twoPassFilter = `[0:v]fps=${fps},scale=${targetWidth}:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`;
    const singlePassFilter = `fps=${fps},scale=${targetWidth}:-2:flags=lanczos,split[s0][s1];[s0]palettegen${paletteStats}[p];[s1][p]paletteuse=dither=${dither}`;

    const args = useTwoPass
      ? [
          ...seekArgs,
          "-i",
          inputName,
          "-i",
          paletteName,
          "-an",
          "-filter_complex",
          twoPassFilter,
          "-loop",
          "0",
          "-f",
          "gif",
          outputName,
        ]
      : [
          ...seekArgs,
          "-i",
          inputName,
          "-an",
          "-filter_complex",
          singlePassFilter,
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
      palette: useTwoPass
        ? {
            args: paletteArgs,
            outputName: paletteName,
          }
        : undefined,
    };

    const worker = workerRef.current;
    if (!worker) {
      activeJobIdRef.current = null;
      activeJobNeedsRestartRef.current = false;
      lastProgressTime.current = 0;
      failJob(pendingJob.id, "The video engine is not available. Reload the page.");
      setProcessing(false);
      return;
    }

    worker.postMessage({
      type: "TRANSCODE",
      payload,
    } satisfies WorkerMessage);
  }, [
    isWorkerLoaded,
    jobQueueKey,
    videoIdsKey,
    queueTick,
    addLog,
    createWorker,
    startBrowserJob,
  ]);

  // Keep the footprint honest: one processing job means one encoder.
  useEffect(() => {
    if (workerError) {
      setIsProcessing(false);
    }
  }, [workerError, setIsProcessing]);

  return { workerError, isEngineLoading, handleCancelJob };
}
