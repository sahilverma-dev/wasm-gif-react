import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Clock, Loader2, Play, Plus, Scissors, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useJobStore } from "../../store/useJobStore";
import { useVideoStore } from "../../store/useVideoStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { buildVideos } from "../../lib/video-files";
import { formatClock } from "../../lib/video-utils";
import { cn } from "../../lib/utils";
import type { ProcessingJob } from "@/types";
import { Button } from "../ui/button";

export function VideoList() {
  const videos = useVideoStore((state) => state.videos);
  const activeVideoId = useVideoStore((state) => state.activeVideoId);
  const setActiveVideo = useVideoStore((state) => state.setActiveVideo);
  const addVideos = useVideoStore((state) => state.addVideos);
  const removeVideo = useVideoStore((state) => state.removeVideo);
  const jobIndex = useJobStore((state) =>
    state.jobs.map((job) => `${job.videoId}:${job.status}`).join("|"),
  );
  const addJob = useJobStore((state) => state.addJob);
  const removeJobsForVideo = useJobStore((state) => state.removeJobsForVideo);
  const removeLimits = useSettingsStore((state) => state.removeLimits);
  const engine = useSettingsStore((state) => state.engine);
  const [isReading, setIsReading] = useState(false);

  const jobEntries = jobIndex ? jobIndex.split("|") : [];
  const isQueued = (videoId: string) =>
    jobEntries.some(
      (entry) => entry === `${videoId}:pending` || entry === `${videoId}:processing`,
    );

  const handleProcessAll = () => {
    let addedCount = 0;

    videos.forEach((video) => {
      if (isQueued(video.id)) return;
      if (video.trim.end - video.trim.start < 0.1) return;

      const job: ProcessingJob = {
        id: uuidv4(),
        videoId: video.id,
        status: "pending",
        progress: 0,
        settings: {
          width: 720,
          fps: 15,
          quality: "medium",
          engine,
        },
        outputFileName: `${video.file.name.split(".")[0]}_${Date.now()}.gif`,
        resolution: `${Math.min(720, video.width)}px`,
        fps: 15,
        duration: video.trim.end - video.trim.start,
      };

      addJob(job);
      addedCount += 1;
    });

    if (addedCount > 0) {
      toast.success(
        `Added ${addedCount} video${addedCount > 1 ? "s" : ""} to the queue`,
      );
    } else {
      toast.info("All videos are already queued");
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsReading(true);
      try {
        const { videos: newVideos, errors } = await buildVideos(
          acceptedFiles,
          {
            removeLimits,
            existing: videos,
          },
        );

        if (newVideos.length > 0) {
          addVideos(newVideos);
          toast.success(
            `Added ${newVideos.length} video${newVideos.length > 1 ? "s" : ""}`,
          );
        }

        errors.forEach((error) => toast.error(error));
      } finally {
        setIsReading(false);
      }
    },
    [addVideos, removeLimits, videos],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".m4v"],
    },
    maxFiles: removeLimits ? undefined : 10,
    disabled: isReading,
    noKeyboard: true,
  });

  if (videos.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold sm:text-xl">
          Queue{" "}
          <span className="font-normal text-muted-foreground">
            ({videos.length})
          </span>
        </h2>
        <Button
          onClick={handleProcessAll}
          size="sm"
          className="h-9 gap-2 px-3"
        >
          <Zap className="h-4 w-4" />
          Process All
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
        <AnimatePresence initial={false}>
          {videos.map((video) => {
            const isActive = activeVideoId === video.id;
            const isProcessing = jobEntries.includes(`${video.id}:processing`);
            const isTrimmed =
              video.trim.start > 0.05 ||
              video.trim.end < video.duration - 0.05;

            return (
              <motion.div
                key={video.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "group relative aspect-video overflow-hidden rounded-xl border-2 bg-muted transition-colors",
                  isActive
                    ? "border-primary shadow-lg ring-2 ring-primary/20"
                    : "border-transparent hover:border-primary/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveVideo(video.id)}
                  aria-label={`Edit ${video.file.name}`}
                  aria-pressed={isActive}
                  className="absolute inset-0 h-full w-full cursor-pointer rounded-[inherit] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted-foreground/20">
                      <Play className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                  )}

                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Play className="h-8 w-8 fill-white/20 text-white" />
                  </span>

                  <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-1 text-[10px] font-medium text-white">
                    <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                      <Clock className="h-3 w-3" />
                      {isProcessing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {formatClock(video.duration)}
                    </span>
                    {isTrimmed && (
                      <span className="flex items-center gap-1 rounded bg-primary/80 px-1.5 py-0.5 backdrop-blur-sm">
                        <Scissors className="h-3 w-3" />
                        Trimmed
                      </span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isProcessing) {
                      toast.error("Cancel the running job before removing this video.");
                      return;
                    }
                    removeJobsForVideo(video.id);
                    removeVideo(video.id);
                  }}
                  disabled={isProcessing}
                  aria-label={`Remove ${video.file.name}`}
                  className="absolute top-1 right-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div
          {...getRootProps()}
          role="button"
          tabIndex={0}
          aria-label="Add more videos"
          aria-busy={isReading}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          }}
          className={cn(
            "flex aspect-video cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs text-muted-foreground transition-colors outline-none",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          {isReading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
          {isReading ? "Reading…" : "Add videos"}
        </div>
      </div>
      <input {...getInputProps()} />
    </div>
  );
}
