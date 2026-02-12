import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useJobStore } from "../store/useJobStore";
import { useVideoStore } from "../store/useVideoStore";
import { useLogStore } from "../store/useLogStore";
import { type WorkerMessage, type WorkerResponse } from "../types";

const STALE_JOB_TIMEOUT_MS = 60_000; // 60 seconds without progress = stale
const WATCHDOG_INTERVAL_MS = 10_000; // Check every 10 seconds

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function useJobProcessor() {
  const {
    jobs,
    updateJobProgress,
    completeJob,
    failJob,
    cancelJob,
    setProcessing,
    retryJob,
  } = useJobStore();
  const { addLog } = useLogStore();
  const { videos } = useVideoStore();
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerLoaded, setIsWorkerLoaded] = useState(false);

  const [workerError, setWorkerError] = useState<string | null>(null);
  const activeToastId = useRef<string | number | null>(null);

  // Stale-job watchdog refs
  const lastProgressTime = useRef<number>(0);

  // Refs to access latest state inside worker callback without re-binding listener
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const updateCurrentJobProgress = useCallback(
    (progress: number) => {
      const job = jobsRef.current.find((j) => j.status === "processing");
      if (job) {
        updateJobProgress(job.id, progress);
        lastProgressTime.current = Date.now();
      }
    },
    [updateJobProgress],
  );

  const completeCurrentJob = useCallback(
    (url: string, size: string) => {
      const job = jobsRef.current.find((j) => j.status === "processing");
      if (job) completeJob(job.id, url, size);
    },
    [completeJob],
  );

  const failCurrentJob = useCallback(
    (error: string) => {
      const job = jobsRef.current.find((j) => j.status === "processing");
      if (job) failJob(job.id, error);
    },
    [failJob],
  );

  // Create or recreate the worker
  const createWorker = useCallback(() => {
    // Terminate old worker if exists
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setIsWorkerLoaded(false);

    const worker = new Worker(
      new URL("../workers/ffmpeg.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      setWorkerError("Failed to load video processor. Please refresh.");
      addLog(`Worker error: ${err.message}`, "error");
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      switch (type) {
        case "LOADED":
          setIsWorkerLoaded(true);
          addLog("FFmpeg Loaded", "info");
          break;
        case "LOG":
          addLog(payload as string, "ffmpeg");
          break;
        case "PROGRESS": {
          const progress = Math.round(payload as number);
          updateCurrentJobProgress(progress);

          // Toast Update
          if (activeToastId.current) {
            toast.loading(`Processing: ${progress}%`, {
              id: activeToastId.current,
            });
          } else {
            activeToastId.current = toast.loading(`Processing: ${progress}%`);
          }
          break;
        }
        case "DONE": {
          const { blob } = payload as { blob: Blob };
          completeCurrentJob(URL.createObjectURL(blob), formatSize(blob.size));
          addLog("Job Completed", "info");

          // Toast Success
          if (activeToastId.current) {
            toast.success("Conversion Complete", {
              id: activeToastId.current,
            });
            activeToastId.current = null;
          }
          break;
        }
        case "ERROR": {
          const errorMsg =
            typeof payload === "string" ? payload : "Unknown error";
          const processingJob = jobsRef.current.find(
            (j) => j.status === "processing",
          );

          addLog(`Error: ${errorMsg}`, "error");

          if (processingJob) {
            // Auto-Retry Logic
            const attempt = processingJob.attempt || 1;
            if (attempt < 2) {
              addLog(
                `Job failed (Attempt ${attempt}). Retrying with safe settings...`,
                "info",
              );
              // Reduce settings for retry
              retryJob(
                processingJob.id,
                {
                  width: 480,
                  fps: 15,
                  quality: "medium",
                },
                errorMsg,
              );

              // Keep toast loading/info for retry
              if (activeToastId.current) {
                toast.loading(`Retrying... (Attempt ${attempt + 1})`, {
                  id: activeToastId.current,
                });
              }
            } else {
              failCurrentJob(errorMsg);
              if (activeToastId.current) {
                toast.error(`Failed: ${errorMsg}`, {
                  id: activeToastId.current,
                });
                activeToastId.current = null;
              }
            }
          } else {
            console.error("Worker Global Error:", errorMsg);
            if (
              errorMsg.includes("SharedArrayBuffer") ||
              errorMsg.includes("FFmpeg")
            ) {
              setWorkerError(errorMsg);
            }
          }
          break;
        }
      }
    };

    worker.postMessage({ type: "LOAD" } as WorkerMessage);
  }, [
    updateCurrentJobProgress,
    completeCurrentJob,
    failCurrentJob,
    addLog,
    retryJob,
  ]);

  // Initialize Worker on mount
  useEffect(() => {
    if (!workerRef.current) {
      // Using queueMicrotask to avoid synchronous setState in effect body
      queueMicrotask(() => createWorker());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (workerError) {
      console.error("Critical Worker Error:", workerError);
    }
  }, [workerError]);

  // Stale-job watchdog — auto-fail jobs stuck without progress for 60s
  useEffect(() => {
    const interval = setInterval(() => {
      const processingJob = jobsRef.current.find(
        (j) => j.status === "processing",
      );
      if (!processingJob) return;

      const elapsed = Date.now() - lastProgressTime.current;
      if (lastProgressTime.current > 0 && elapsed > STALE_JOB_TIMEOUT_MS) {
        addLog(
          `Job "${processingJob.outputFileName}" timed out after ${Math.round(elapsed / 1000)}s with no progress. Terminating...`,
          "error",
        );

        failJob(processingJob.id, "Timed out — no progress for 60 seconds");
        lastProgressTime.current = 0;

        // Terminate and recreate worker to unblock
        createWorker();

        if (activeToastId.current) {
          toast.error("Job timed out", { id: activeToastId.current });
          activeToastId.current = null;
        }
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [addLog, failJob, createWorker]);

  // Cancel handler that recreates worker when cancelling a processing job
  const handleCancelJob = useCallback(
    (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;

      cancelJob(jobId);

      // If the cancelled job was processing, we need to kill the worker
      // because ffmpeg.exec() cannot be interrupted
      if (job.status === "processing") {
        addLog("Terminating stuck worker and restarting...", "info");
        createWorker();

        if (activeToastId.current) {
          toast.info("Job cancelled", { id: activeToastId.current });
          activeToastId.current = null;
        } else {
          toast.info("Job cancelled");
        }
      } else {
        toast.info("Job cancelled");
      }
    },
    [cancelJob, addLog, createWorker],
  );

  // Job Queue Processor
  useEffect(() => {
    if (!isWorkerLoaded) return;

    const pendingJob = jobs.find((j) => j.status === "pending");
    const processingJob = jobs.find((j) => j.status === "processing");

    if (processingJob) {
      setProcessing(true);
      return;
    }

    if (pendingJob) {
      setProcessing(true);
      const video = videos.find((v) => v.id === pendingJob.videoId);

      if (!video) {
        failJob(pendingJob.id, "Video source not found");
        return;
      }

      updateJobProgress(pendingJob.id, 0);
      lastProgressTime.current = Date.now(); // Reset watchdog on new job

      const trimStart = pendingJob.trimRange
        ? pendingJob.trimRange.start
        : video.trim.start;
      const trimEnd = pendingJob.trimRange
        ? pendingJob.trimRange.end
        : video.trim.end;
      const duration = trimEnd - trimStart;

      const { width, fps, quality } = pendingJob.settings;

      // Derive input filename from actual video extension for correct demuxing
      const ext = video.file.name.split(".").pop()?.toLowerCase() || "mp4";
      const inputName = `input.${ext}`;

      let targetWidth = width === "auto" ? video.width : width;

      // Smart Scaling: Cap resolution to source width to prevent upscaling
      if (targetWidth > video.width) {
        addLog(
          `Smart Scaling: Capping output width to source (${video.width}px) from requested ${targetWidth}px`,
          "info",
        );
        targetWidth = video.width;
      }

      const scaleStr = `,scale=${targetWidth}:-2:flags=lanczos`;

      let dither = "bayer:bayer_scale=5"; // Medium default
      if (quality === "high") dither = "sierra2_4a";
      if (quality === "low") dither = "bayer:bayer_scale=3";

      const filterComplex = `fps=${fps}${scaleStr},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=${dither}`;

      const args = [
        "-ss",
        trimStart.toFixed(3),
        "-t",
        duration.toFixed(3),
        "-i",
        inputName,
        "-filter_complex",
        filterComplex,
        "-f",
        "gif",
        pendingJob.outputFileName,
      ];

      workerRef.current?.postMessage({
        type: "TRANSCODE",
        payload: {
          file: video.file,
          inputName,
          outputName: pendingJob.outputFileName,
          args,
        },
      });
    } else {
      setProcessing(false);
    }
  }, [
    jobs,
    isWorkerLoaded,
    videos,
    updateJobProgress,
    failJob,
    setProcessing,
    addLog,
  ]);

  return { workerError, isWorkerLoaded, handleCancelJob };
}
