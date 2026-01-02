import { useEffect, useRef, useState, useCallback } from "react";
import { useJobStore } from "../store/useJobStore";
import { useVideoStore } from "../store/useVideoStore";
import { type WorkerMessage, type WorkerResponse } from "../types";

export function useJobProcessor() {
  const { jobs, updateJobProgress, completeJob, failJob, setProcessing } =
    useJobStore();
  const { videos } = useVideoStore();
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerLoaded, setIsWorkerLoaded] = useState(false);

  // Refs to access latest state inside worker callback without re-binding listener
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const updateCurrentJobProgress = useCallback(
    (progress: number) => {
      const job = jobsRef.current.find((j) => j.status === "processing");
      if (job) updateJobProgress(job.id, progress);
    },
    [updateJobProgress]
  );

  const completeCurrentJob = useCallback(
    (url: string) => {
      const job = jobsRef.current.find((j) => j.status === "processing");
      if (job) completeJob(job.id, url);
    },
    [completeJob]
  );

  const failCurrentJob = useCallback(
    (error: string) => {
      const job = jobsRef.current.find((j) => j.status === "processing");
      if (job) failJob(job.id, error);
    },
    [failJob]
  );

  // Initialize Worker
  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/ffmpeg.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, payload } = event.data;

        switch (type) {
          case "LOADED":
            setIsWorkerLoaded(true);
            break;
          case "PROGRESS":
            updateCurrentJobProgress(payload as number);
            break;
          case "DONE": {
            const { blob } = payload as { blob: Blob };
            completeCurrentJob(URL.createObjectURL(blob));
            break;
          }
          case "ERROR":
            failCurrentJob(
              typeof payload === "string" ? payload : "Unknown error"
            );
            break;
        }
      };

      workerRef.current.postMessage({ type: "LOAD" } as WorkerMessage);
    }
  }, [updateCurrentJobProgress, completeCurrentJob, failCurrentJob]);

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

      // Determine TRIM range
      const trimStart = pendingJob.trimRange
        ? pendingJob.trimRange.start
        : video.trim.start;
      const trimEnd = pendingJob.trimRange
        ? pendingJob.trimRange.end
        : video.trim.end;
      const duration = trimEnd - trimStart;

      const { width, fps, quality } = pendingJob.settings;

      // Construct FFmpeg Filter Complex for High Quality
      // 1. fps
      // 2. scale (with lanczos for quality)
      // 3. split (for palettegen)
      // 4. palettegen -> [palette]
      // 5. [video][palette] paletteuse (dither settings)

      const scaleStr =
        width === "auto" ? "" : `,scale=${width}:-2:flags=lanczos`;

      // Map Quality to Dither Settings
      let dither = "bayer:bayer_scale=5"; // Medium default
      if (quality === "high") dither = "sierra2_4a";
      if (quality === "low") dither = "bayer:bayer_scale=3"; // rougher but maybe faster?

      // Note: FFmpeg strict argument parsing might fail if filter string has spaces.
      // We keep it compact.
      const filterComplex = `fps=${fps}${scaleStr},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=${dither}`;

      // If low quality, maybe skip palettegen for speed?
      // User requested "FFmpeg Logic" implying upgrading it, so we stick to palettegen for all modes but vary dither.
      // Actually, for "Low", we could just do direct map which is faster but uglier.
      // Let's assume user wants quality per the "WOW" requirement, but labeled "Low" might mean file size.
      // Optimizing palette for file size is stats_mode=diff usually.

      const args = [
        "-ss",
        trimStart.toString(),
        "-t",
        duration.toString(),
        "-i",
        "input.mp4",
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
          outputName: pendingJob.outputFileName,
          args,
        },
      });
    } else {
      setProcessing(false);
    }
  }, [jobs, isWorkerLoaded, videos, updateJobProgress, failJob, setProcessing]);
}
