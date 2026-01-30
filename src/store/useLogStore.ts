import { create } from "zustand";
import type { LogEntry } from "../types";
import { v4 as uuidv4 } from "uuid";

interface LogState {
  logs: LogEntry[];
  isEnabled: boolean;
  filter: string;

  addLog: (message: string, type?: LogEntry["type"]) => void;
  clearLogs: () => void;
  setLoggingEnabled: (enabled: boolean) => void;
  setFilter: (filter: string) => void;
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  isEnabled: true,
  filter: "",

  addLog: (message, type = "info") => {
    if (!get().isEnabled) return;

    // Optional: Limit log size to prevent memory issues
    const newLog: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      message,
      type,
    };

    set((state) => ({
      logs: [newLog, ...state.logs].slice(0, 1000), // Keep last 1000 logs
    }));
  },

  clearLogs: () => set({ logs: [] }),
  setLoggingEnabled: (enabled) => set({ isEnabled: enabled }),
  setFilter: (filter) => set({ filter }),
}));
