import { useJobStore } from "../../store/useJobStore";
import { useVideoStore } from "../../store/useVideoStore";
import { X, Play, Clock, Scissors, PlusIcon, Zap } from "lucide-react";
import { formatTime, getMetadata } from "../../lib/video-utils";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";
import type { VideoFile, ProcessingJob } from "@/types";
import { toast } from "sonner";
import { Button } from "../ui/button";

import { v4 as uuidv4 } from "uuid";

export function VideoList() {
  const { videos, activeVideoId, setActiveVideo, addVideos, removeVideo } =
    useVideoStore();
  const { jobs, addJob } = useJobStore();

  const handleProcessAll = () => {
    let addedCount = 0;

    videos.forEach((video) => {
      // Check if video is already in queue (pending or processing)
      const exists = jobs.some(
        (j) =>
          j.videoId === video.id &&
          (j.status === "pending" || j.status === "processing"),
      );

      if (exists) return;

      const job: ProcessingJob = {
        id: uuidv4(),
        videoId: video.id,
        status: "pending",
        progress: 0,
        settings: {
          width: 720,
          fps: 15,
          quality: "medium",
        },
        outputFileName: `${video.file.name.split(".")[0]}_${Date.now()}.gif`,
      };

      addJob(job);
      addedCount++;
    });

    if (addedCount > 0) {
      toast.success(
        `Added ${addedCount} video${addedCount > 1 ? "s" : ""} to queue`,
      );
    } else {
      toast.info("All videos are already in the queue");
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newVideos: VideoFile[] = [];
      const errors: string[] = [];

      // Process files sequentially to keep UI responsive-ish (could be concurrent but simple for now)
      for (const file of acceptedFiles) {
        if (file.size > 100 * 1024 * 1024) {
          // 100MB limit
          errors.push(`${file.name}: File too large (Max 100MB)`);
          continue;
        }

        try {
          const metadata = await getMetadata(file);

          if (metadata.duration > 60) {
            errors.push(`${file.name}: Video too long (Max 60s)`);
            continue;
          }

          newVideos.push({
            id: uuidv4(),
            file,
            blobUrl: URL.createObjectURL(file), // Still useful for player
            ...metadata,
            trim: { start: 0, end: metadata.duration },
            clips: [],
          });
        } catch {
          errors.push(`${file.name}: Failed to load video`);
        }
      }

      if (newVideos.length > 0) {
        addVideos(newVideos);
        toast.success(
          `Added ${newVideos.length} video${newVideos.length > 1 ? "s" : ""}`,
        );
      }

      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }
    },
    [addVideos],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".webm"],
    },
    maxFiles: 10,
  });

  if (videos.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Queue ({videos.length})</h2>
        <Button onClick={handleProcessAll} size="sm" className="h-8 gap-2">
          <Zap className="w-4 h-4" />
          Process All
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <AnimatePresence>
          {videos.map((video) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              layout
              className={cn(
                "relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-video bg-muted",
                activeVideoId === video.id
                  ? "border-primary ring-2 ring-primary/20 shadow-lg"
                  : "border-transparent hover:border-primary/50",
              )}
              onClick={() => setActiveVideo(video.id)}
            >
              {/* Thumbnail */}
              <img
                src={video.thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-contain"
              />

              {/* Overlay Info */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <Play className="w-8 h-8 text-white fill-white/20" />
              </div>

              {/* Status Badges */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end text-[10px] font-medium text-white">
                <div className="bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(video.duration)}
                </div>
                {(video.trim.start > 0 || video.trim.end < video.duration) && (
                  <div className="bg-primary/80 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                    <Scissors className="w-3 h-3" />
                    Trimmed
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeVideo(video.id);
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-destructive/80 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
          <div
            {...getRootProps()}
            // key={uuidv4()}
            className={cn(
              "relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-video flex items-center justify-center gap-2 bg-muted border-black/50 hover:border-black/10",
              isDragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
            )}
          >
            <PlusIcon /> Add Videos
          </div>
        </AnimatePresence>
      </div>
      <input {...getInputProps()} />
    </div>
  );
}
