import { useState } from "react";
import { useVideoStore } from "../../store/useVideoStore";
import { useJobStore } from "../../store/useJobStore";
import { type GifSettings, type ProcessingJob } from "../../types";
import { Settings, Zap, Grid, Film } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { JobList } from "./JobList";
import { cn } from "../../lib/utils";
import { formatTime } from "../../lib/video-utils";

type Mode = "simple" | "clips";

export function ProcessingPanel() {
  const { videos, activeVideoId } = useVideoStore();
  const { addJob } = useJobStore();

  const video = videos.find((v) => v.id === activeVideoId);
  const [mode, setMode] = useState<Mode>("simple");
  const [settings, setSettings] = useState<GifSettings>({
    width: 480,
    fps: 15,
    quality: "medium",
  });

  // Clip Mode State
  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(2);

  const handleGenerate = () => {
    if (!video) return;

    const job: ProcessingJob = {
      id: uuidv4(),
      videoId: video.id,
      status: "pending",
      progress: 0,
      settings: { ...settings },
      outputFileName: `${video.file.name.split(".")[0]}_${Date.now()}.gif`,
    };
    addJob(job);
    toast.info("Added to queue");
  };

  const generateBatch = () => {
    if (!video) return;
    const trimStart = video.trim.start;
    const trimEnd = video.trim.end;
    const totalDuration = trimEnd - trimStart;

    // Safety check
    if (clipDuration > totalDuration) {
      toast.error("Clip duration longer than selected video range");
      return;
    }

    const step = (totalDuration - clipDuration) / (clipCount - 1 || 1);

    for (let i = 0; i < clipCount; i++) {
      const start = trimStart + step * i;
      const end = start + clipDuration;

      const job: ProcessingJob = {
        id: uuidv4(),
        videoId: video.id,
        status: "pending",
        progress: 0,
        settings: { ...settings },
        outputFileName: `${video.file.name.split(".")[0]}_clip${
          i + 1
        }_${Date.now()}.gif`,
        trimRange: { start, end },
      };
      addJob(job);
    }
    toast.success(`Added ${clipCount} clips to queue`);
  };

  if (!video) return null;

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6 h-fit">
      {/* Mode Switcher */}
      <div className="flex bg-muted/50 p-1 rounded-lg">
        <button
          onClick={() => setMode("simple")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all",
            mode === "simple"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Film className="w-4 h-4" />
          Single GIF
        </button>
        <button
          onClick={() => setMode("clips")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all",
            mode === "clips"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Grid className="w-4 h-4" />
          Clip Batch
        </button>
      </div>

      <div className="flex items-center gap-2 border-b pb-4">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Settings</h3>
      </div>

      <div className="space-y-4">
        {mode === "clips" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                <span>Number of Clips</span>
                <span className="text-primary">{clipCount}</span>
              </label>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={clipCount}
                onChange={(e) => setClipCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                <span>Duration per Clip</span>
                <span className="text-primary">{formatTime(clipDuration)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={clipDuration}
                onChange={(e) => setClipDuration(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Will generate {clipCount} clips of {clipDuration}s each,
              distributed evenly.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Resolution</label>
          <div className="grid grid-cols-3 gap-2">
            {[320, 480, 720].map((w) => (
              <button
                key={w}
                onClick={() => setSettings({ ...settings, width: w })}
                className={cn(
                  "px-3 py-2 rounded-md text-sm border transition-all",
                  settings.width === w
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                )}
              >
                {w}px
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Frame Rate (FPS)</label>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground w-8">
              {settings.fps}
            </span>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={settings.fps}
              onChange={(e) =>
                setSettings({ ...settings, fps: Number(e.target.value) })
              }
              className="grow"
            />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={mode === "simple" ? handleGenerate : generateBatch}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
        >
          <Zap className="w-5 h-5 fill-yellow-300 text-yellow-300" />
          {mode === "simple" ? "Create GIF" : `Create ${clipCount} GIFs`}
        </button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Estimated size: ~{(video.duration * settings.fps * 0.05).toFixed(1)}{" "}
          MB
        </p>
      </div>

      <JobList />
    </div>
  );
}
