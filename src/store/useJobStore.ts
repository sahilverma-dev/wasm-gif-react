import { create } from "zustand";
import type { ProcessingJob, GifSettings } from "../types";

interface JobState {
  jobs: ProcessingJob[];
  isProcessing: boolean;

  addJob: (job: ProcessingJob) => void;
  updateJobProgress: (id: string, progress: number) => void;
  completeJob: (id: string, resultUrl: string, size?: string) => void;
  failJob: (id: string, error: string) => void;
  cancelJob: (id: string) => void;
  removeJob: (id: string) => void;
  requeueJob: (id: string) => void;
  retryJob: (id: string, newSettings: GifSettings, reason: string) => void;
  clearCompleted: () => void;
  setProcessing: (isProcessing: boolean) => void;
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  isProcessing: false,

  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),

  updateJobProgress: (id, progress) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: "processing", progress } : j,
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
        j.id === id ? { ...j, status: "cancelled" } : j,
      ),
    })),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    })),

  requeueJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "pending",
              progress: 0,
              error: undefined,
              recoveryReason: undefined,
            }
          : j,
      ),
    })),

  retryJob: (id, newSettings, reason) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "pending",
              progress: 0,
              settings: newSettings,
              attempt: (j.attempt || 1) + 1,
              recoveryReason: reason,
            }
          : j,
      ),
    })),

  clearCompleted: () =>
    set((state) => ({
      jobs: state.jobs.filter(
        (j) =>
          j.status !== "completed" &&
          j.status !== "cancelled" &&
          j.status !== "error",
      ),
    })),

  setProcessing: (isProcessing) => set({ isProcessing }),
}));
