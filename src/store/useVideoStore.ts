import { create } from "zustand";
import type { VideoFile, VideoClip } from "../types";

interface VideoState {
  videos: VideoFile[];
  activeVideoId: string | null;
  addVideos: (newVideos: VideoFile[]) => void;
  removeVideo: (id: string) => void;
  updateTrim: (id: string, start: number, end: number) => void;
  setActiveVideo: (id: string | null) => void;
  addClip: (videoId: string, clip: VideoClip) => void;
  removeClip: (videoId: string, clipId: string) => void;
  updateClip: (
    videoId: string,
    clipId: string,
    updates: Partial<VideoClip>
  ) => void;
  clearAll: () => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  videos: [],
  activeVideoId: null,

  addVideos: (newVideos) =>
    set((state) => ({
      videos: [...state.videos, ...newVideos],
      activeVideoId:
        state.activeVideoId || (newVideos.length > 0 ? newVideos[0].id : null),
    })),

  removeVideo: (id) =>
    set((state) => {
      const newVideos = state.videos.filter((v) => v.id !== id);
      return {
        videos: newVideos,
        activeVideoId:
          state.activeVideoId === id
            ? newVideos.length > 0
              ? newVideos[0].id
              : null
            : state.activeVideoId,
      };
    }),

  updateTrim: (id, start, end) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === id ? { ...v, trim: { start, end } } : v
      ),
    })),

  setActiveVideo: (id) => set({ activeVideoId: id }),

  addClip: (videoId, clip) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === videoId ? { ...v, clips: [...(v.clips || []), clip] } : v
      ),
    })),

  removeClip: (videoId, clipId) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === videoId
          ? { ...v, clips: v.clips?.filter((c) => c.id !== clipId) || [] }
          : v
      ),
    })),

  updateClip: (videoId, clipId, updates) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === videoId
          ? {
              ...v,
              clips:
                v.clips?.map((c) =>
                  c.id === clipId ? { ...c, ...updates } : c
                ) || [],
            }
          : v
      ),
    })),

  clearAll: () => set({ videos: [], activeVideoId: null }),
}));
