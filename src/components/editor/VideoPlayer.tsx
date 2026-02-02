import { useRef, useState, useEffect } from "react";
import { useVideoStore } from "../../store/useVideoStore";
import {
  Play,
  Pause,
  Scissors,
  Info,
  ChevronDown,
  FileText,
  Monitor,
  Clock,
  HardDrive,
} from "lucide-react";
import { TrimSlider } from "./TrimSlider";
import { formatTime, formatBytes } from "../../lib/video-utils";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export function VideoPlayer() {
  const { videos, activeVideoId, updateTrim } = useVideoStore();

  const video = videos.find((v) => v.id === activeVideoId);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showMetadata, setShowMetadata] = useState(false);

  // Sync state when video changes
  // Sync state when video changes
  useEffect(() => {
    if (video && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - video.trim.start) > 0.1) {
        videoRef.current.currentTime = video.trim.start;
      }
      setCurrentTime((prev) =>
        prev !== video.trim.start ? video.trim.start : prev,
      );
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  // Loop logic
  const handleTimeUpdate = () => {
    if (!videoRef.current || !video) return;

    setCurrentTime(videoRef.current.currentTime);

    if (videoRef.current.currentTime >= video.trim.end) {
      videoRef.current.currentTime = video.trim.start;
      if (!videoRef.current.loop) {
        // Manual loop if needed, but we can restart
        videoRef.current.play();
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If at end, seek to start
      if (video && videoRef.current.currentTime >= video.trim.end) {
        videoRef.current.currentTime = video.trim.start;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const onTrimChange = (start: number, end: number) => {
    if (!video) return;
    updateTrim(video.id, start, end);

    // If current time is out of bounds, snap to start
    if (currentTime < start || currentTime > end) {
      if (videoRef.current) {
        videoRef.current.currentTime = start;
        setCurrentTime(start);
      }
    }
  };

  if (!video) {
    return (
      <div className="w-full aspect-video bg-muted/20 rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
        Select a video to edit
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-500">
      <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl aspect-video group">
        <video
          ref={videoRef}
          src={video.blobUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />

        {/* Custom Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors text-white"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <div className="text-white text-xs font-mono">
            {formatTime(currentTime)} / {formatTime(video.duration)}
          </div>

          <div className="grow" />

          {/* Maybe add speed control here later */}
        </div>
      </div>

      <div className="bg-card border border-t-0 rounded-xl p-2 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm md:text-lg flex items-center gap-2">
            <Scissors className="w-4 h-4 text-primary" />
            Trim Video
          </h3>
          <span className="text-xs md:text-sm text-muted-foreground">
            Cut the segment you want to convert
          </span>
        </div>
        <TrimSlider
          duration={video.duration}
          startTime={video.trim.start}
          endTime={video.trim.end}
          onValueChange={onTrimChange}
        />{" "}
        {/* Metadata Collapse */}
        <div className="border p-4">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full group/meta"
          >
            <Info className="w-4 h-4" />
            <span>Video Details</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200 ml-auto opacity-50 group-hover/meta:opacity-100",
                showMetadata && "rotate-180",
              )}
            />
          </button>

          <AnimatePresence>
            {showMetadata && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs md:text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Name
                    </p>
                    <p className="font-medium truncate" title={video.file.name}>
                      {video.file.name}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5" /> Resolution
                    </p>
                    <p className="font-medium">
                      {video.width} x {video.height}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5" /> Size
                    </p>
                    <p className="font-medium">
                      {formatBytes(video.file.size)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Duration
                    </p>
                    <p className="font-medium">{formatTime(video.duration)}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
