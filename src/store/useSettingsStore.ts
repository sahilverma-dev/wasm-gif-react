import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  removeLimits: boolean;
  showLogs: boolean;
  toggleRemoveLimits: () => void;
  toggleShowLogs: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      removeLimits: false,
      showLogs: false,
      toggleRemoveLimits: () =>
        set((state) => ({ removeLimits: !state.removeLimits })),
      toggleShowLogs: () => set((state) => ({ showLogs: !state.showLogs })),
    }),
    {
      name: "gif-app-settings",
    },
  ),
);
