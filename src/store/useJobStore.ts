import { create } from "zustand";
import type { ProcessingJob, GifSettings } from "../types";
import { releaseObjectUrl } from "../lib/blob";

interface JobState {
  jobs: ProcessingJob[];
  isProcessing: boolean;

  addJob: (job: ProcessingJob) => void;
  startJob: (id: string) => void;
  updateJobProgress: (id: string, progress: number) => void;
  completeJob: (id: string, resultUrl: string, size?: string) => void;
  failJob: (id: string, error: string) => void;
  cancelJob: (id: string) => void;
  removeJob: (id: string) => void;
  removeJobsForVideo: (videoId: string) => void;
  requeueJob: (id: string) => void;
  retryJob: (id: string, newSettings: GifSettings, reason: string) => void;
  clearCompleted: () => void;
  setProcessing: (isProcessing: boolean) => void;
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  isProcessing: false,

  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),

  // The queue explicitly moves a job to "processing". Previously this only
  // happened when the first progress event arrived, so a job that produced no
  // progress (or failed instantly) never had an owning job to complete.
  startJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? { ...j, status: "processing", progress: 0, error: undefined }
          : j,
      ),
    })),

  updateJobProgress: (id, progress) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id && j.status === "processing" ? { ...j, progress } : j,
      ),
    })),

  completeJob: (id, resultUrl, size) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? { ...j, status: "completed", progress: 100, resultUrl, size }
          : j,
      ),
    })),

  failJob: (id, error) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: "error", error } : j,
      ),
    })),

  cancelJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: "cancelled", progress: 0 } : j,
      ),
    })),

  removeJob: (id) =>
    set((state) => {
      const job = state.jobs.find((j) => j.id === id);
      releaseObjectUrl(job?.resultUrl);
      return { jobs: state.jobs.filter((j) => j.id !== id) };
    }),

  removeJobsForVideo: (videoId) =>
    set((state) => {
      const removed = state.jobs.filter((j) => j.videoId === videoId);
      removed.forEach((job) => releaseObjectUrl(job.resultUrl));
      return {
        jobs: state.jobs.filter((j) => j.videoId !== videoId),
      };
    }),

  requeueJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id !== id) return j;
        releaseObjectUrl(j.resultUrl);
        return {
          ...j,
          status: "pending",
          progress: 0,
          error: undefined,
          recoveryReason: undefined,
          resultUrl: undefined,
          size: undefined,
        };
      }),
    })),

  retryJob: (id, newSettings, reason) =>
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id !== id) return j;
        releaseObjectUrl(j.resultUrl);
        return {
          ...j,
          status: "pending",
          progress: 0,
          settings: newSettings,
          attempt: (j.attempt || 1) + 1,
          recoveryReason: reason,
          error: undefined,
          resultUrl: undefined,
          size: undefined,
        };
      }),
    })),

  clearCompleted: () =>
    set((state) => {
      const kept = state.jobs.filter(
        (j) =>
          j.status !== "completed" &&
          j.status !== "cancelled" &&
          j.status !== "error",
      );
      state.jobs.forEach((job) => {
        if (!kept.includes(job)) releaseObjectUrl(job.resultUrl);
      });
      return { jobs: kept };
    }),

  setProcessing: (isProcessing) => set({ isProcessing }),
}));
