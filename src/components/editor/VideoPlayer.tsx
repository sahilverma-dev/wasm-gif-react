import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Clock,
  ChevronDown,
  FileText,
  HardDrive,
  Info,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { useVideoStore } from "../../store/useVideoStore";
import { useJobStore } from "../../store/useJobStore";
import { TrimSlider } from "./TrimSlider";
import { formatBytes, formatClock, formatTime } from "../../lib/video-utils";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export function VideoPlayer() {
  const videos = useVideoStore((state) => state.videos);
  const activeVideoId = useVideoStore((state) => state.activeVideoId);
  const updateTrim = useVideoStore((state) => state.updateTrim);
  const isProcessing = useJobStore((state) =>
    state.jobs.some(
      (job) => job.videoId === activeVideoId && job.status === "processing",
    ),
  );

  const video = videos.find((entry) => entry.id === activeVideoId);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showMetadata, setShowMetadata] = useState(false);

  const videoId = video?.id;

  if (!video) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 text-muted-foreground">
        Select a video to edit
      </div>
    );
  }

  const play = () => {
    void videoRef.current?.play().catch(() => {
      // Autoplay policies or a decode error: the UI stays paused.
      setIsPlaying(false);
    });
  };

  const handleTimeUpdate = () => {
    const element = videoRef.current;
    if (!element) return;

    setCurrentTime(element.currentTime);

    if (element.currentTime >= video.trim.end) {
      element.currentTime = video.trim.start;
      if (!element.paused) play();
    }
  };

  const togglePlay = () => {
    const element = videoRef.current;
    if (!element) return;

    if (element.paused) {
      if (element.currentTime >= video.trim.end) {
        element.currentTime = video.trim.start;
      }
      play();
    } else {
      element.pause();
    }
  };

  const onTrimChange = (start: number, end: number) => {
    updateTrim(video.id, start, end);

    if (currentTime < start || currentTime > end) {
      if (videoRef.current) {
        videoRef.current.currentTime = start;
      }
      setCurrentTime(start);
    }
  };

  const resetTrim = () => {
    updateTrim(video.id, 0, video.duration);
    if (videoRef.current) videoRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
        <video
          key={videoId}
          ref={videoRef}
          src={video.blobUrl}
          preload="metadata"
          className="h-full w-full object-contain"
          playsInline
          onClick={togglePlay}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = video.trim.start;
            setCurrentTime(video.trim.start);
            setIsPlaying(false);
          }}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Controls stay visible on touch screens, where hover does not exist. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 bg-linear-to-t from-black/70 to-transparent p-3 pt-10 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
            aria-pressed={isPlaying}
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-colors hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>

          <div className="pointer-events-none font-mono text-xs text-white">
            {formatClock(currentTime)} / {formatClock(video.duration)}
          </div>

          <div className="grow" />

          <span className="pointer-events-none rounded bg-black/40 px-2 py-1 text-[10px] font-medium text-white/80">
            {formatClock(video.trim.start)}–{formatClock(video.trim.end)}
          </span>
        </div>
      </div>

      <div className="space-y-4 rounded-b-xl border border-t-0 bg-card p-3 sm:p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Scissors className="h-4 w-4 text-primary" />
            Trim video
          </h3>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Cut the segment you want to convert
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={resetTrim}
              disabled={isProcessing}
              className="gap-1 text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        <TrimSlider
          duration={video.duration}
          startTime={video.trim.start}
          endTime={video.trim.end}
          onValueChange={onTrimChange}
          isProcessing={isProcessing}
        />

        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setShowMetadata((value) => !value)}
            aria-expanded={showMetadata}
            className="flex w-full items-center gap-2 p-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Info className="h-4 w-4" />
            <span>Video details</span>
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 opacity-50 transition-transform duration-200",
                showMetadata && "rotate-180",
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {showMetadata && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <dl className="grid grid-cols-2 gap-3 px-3 pb-3 text-xs md:grid-cols-4 md:text-sm">
                  <div className="min-w-0 space-y-1">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> Name
                    </dt>
                    <dd
                      className="truncate font-medium"
                      title={video.file.name}
                    >
                      {video.file.name}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Monitor className="h-3.5 w-3.5" /> Resolution
                    </dt>
                    <dd className="font-medium">
                      {video.width} × {video.height}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <HardDrive className="h-3.5 w-3.5" /> Size
                    </dt>
                    <dd className="font-medium">
                      {formatBytes(video.file.size)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Duration
                    </dt>
                    <dd className="font-medium">
                      {formatTime(video.duration)}
                    </dd>
                  </div>
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
