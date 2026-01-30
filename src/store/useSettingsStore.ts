import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  removeLimits: boolean;
  toggleRemoveLimits: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      removeLimits: false,
      toggleRemoveLimits: () =>
        set((state) => ({ removeLimits: !state.removeLimits })),
    }),
    {
      name: "gif-app-settings",
    },
  ),
);
