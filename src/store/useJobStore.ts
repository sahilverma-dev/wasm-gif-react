import { create } from "zustand";
import type { ProcessingJob } from "../types";

interface JobState {
  jobs: ProcessingJob[];
  isProcessing: boolean;

  addJob: (job: ProcessingJob) => void;
  updateJobProgress: (id: string, progress: number) => void;
  completeJob: (id: string, resultUrl: string) => void;
  failJob: (id: string, error: string) => void;
  cancelJob: (id: string) => void;
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
        j.id === id ? { ...j, status: "processing", progress } : j
      ),
    })),

  completeJob: (id, resultUrl) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? { ...j, status: "completed", progress: 100, resultUrl }
          : j
      ),
    })),

  failJob: (id, error) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: "error", error } : j
      ),
    })),

  cancelJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: "cancelled" } : j
      ),
    })),

  clearCompleted: () =>
    set((state) => ({
      jobs: state.jobs.filter(
        (j) => j.status !== "completed" && j.status !== "cancelled"
      ),
    })),

  setProcessing: (isProcessing) => set({ isProcessing }),
}));
