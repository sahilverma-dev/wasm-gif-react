import { useVideoStore } from "../../store/useVideoStore";
import { X, Play, Clock, Scissors } from "lucide-react";
import { formatTime } from "../../lib/video-utils";
import { cn } from "../../lib/utils"; // Assuming generic utility exists, else I'll make one or inline
import { motion, AnimatePresence } from "motion/react";

export function VideoList() {
  const { videos, activeVideoId, setActiveVideo, removeVideo } =
    useVideoStore();

  if (videos.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Queue ({videos.length})</h2>
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
                  : "border-transparent hover:border-primary/50"
              )}
              onClick={() => setActiveVideo(video.id)}
            >
              {/* Thumbnail */}
              <img
                src={video.thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
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
        </AnimatePresence>
      </div>
    </div>
  );
}
