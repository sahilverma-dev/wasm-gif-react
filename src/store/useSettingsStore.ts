import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EncoderEngine } from "../types";

interface SettingsState {
  removeLimits: boolean;
  showLogs: boolean;
  engine: EncoderEngine;
  toggleRemoveLimits: () => void;
  toggleShowLogs: () => void;
  setEngine: (engine: EncoderEngine) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      removeLimits: false,
      showLogs: false,
      // The browser encoder is the default: no 30 MB download, works on the
      // device's own decoder.
      engine: "browser",
      toggleRemoveLimits: () =>
        set((state) => ({ removeLimits: !state.removeLimits })),
      toggleShowLogs: () => set((state) => ({ showLogs: !state.showLogs })),
      setEngine: (engine) => set({ engine }),
    }),
    {
      name: "gif-app-settings",
    },
  ),
);
