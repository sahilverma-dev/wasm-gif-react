import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Film, Grid, Settings } from "lucide-react";
import { useVideoStore } from "../../store/useVideoStore";
import { useJobStore } from "../../store/useJobStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { type GifSettings, type ProcessingJob } from "../../types";
import { clampRange } from "../../lib/video-files";
import { formatTime } from "../../lib/video-utils";
import { cn } from "../../lib/utils";
import { JobList } from "./JobList";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode = "simple" | "clips";

const RESOLUTIONS = [144, 320, 480, 720, 1080];

const QUALITY_BYTES_PER_PIXEL: Record<GifSettings["quality"], number> = {
  low: 0.03,
  medium: 0.045,
  high: 0.065,
};

function estimateGifBytes(
  duration: number,
  width: number,
  fps: number,
  quality: GifSettings["quality"],
): number {
  const height = Math.round((width * 9) / 16);
  const frames = Math.max(1, duration * fps);
  return frames * width * height * QUALITY_BYTES_PER_PIXEL[quality];
}

export function ProcessingPanel() {
  const videos = useVideoStore((state) => state.videos);
  const activeVideoId = useVideoStore((state) => state.activeVideoId);
  const addJob = useJobStore((state) => state.addJob);
  const engine = useSettingsStore((state) => state.engine);
  const setEngine = useSettingsStore((state) => state.setEngine);

  const video = videos.find((entry) => entry.id === activeVideoId);
  const [mode, setMode] = useState<Mode>("simple");
  const [settings, setSettings] = useState<Omit<GifSettings, "engine">>({
    width: 720,
    fps: 15,
    quality: "medium",
  });

  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(2);

  if (!video) return null;

  const range = clampRange(video.trim, video.duration);
  const selectedDuration = Math.max(0, range.end - range.start);
  const tooShort = selectedDuration < 0.1;
  const effectiveWidth =
    settings.width === "auto" ? video.width : Math.min(settings.width, video.width);
  const outputWidth = Math.max(2, effectiveWidth % 2 === 0 ? effectiveWidth : effectiveWidth - 1);

  const createJob = (
    overrides: Partial<ProcessingJob> = {},
  ): ProcessingJob => ({
    id: uuidv4(),
    videoId: video.id,
    status: "pending",
    progress: 0,
    settings: { ...settings, engine },
    outputFileName: `${video.file.name.split(".")[0]}_${Date.now()}.gif`,
    resolution: `${outputWidth}px`,
    fps: settings.fps,
    duration: selectedDuration,
    trimRange: range,
    ...overrides,
  });

  const handleGenerate = () => {
    if (tooShort) {
      toast.error("Select at least 0.1 seconds of video.");
      return;
    }
    addJob(createJob());
    toast.success("Added to the queue");
  };

  const handleGenerateBatch = () => {
    if (tooShort) {
      toast.error("Select at least 0.1 seconds of video.");
      return;
    }

    const perClip = Math.min(clipDuration, selectedDuration);
    // Overlapping clips would produce identical GIFs, so never ask for more
    // clips than can fit in the selection.
    const maxDistinctClips = Math.max(
      1,
      Math.floor(selectedDuration / Math.max(perClip, 0.1)),
    );
    const count = Math.min(Math.max(2, Math.round(clipCount)), maxDistinctClips);
    const step = count > 1 ? (selectedDuration - perClip) / (count - 1) : 0;
    const batchStamp = Date.now();

    for (let index = 0; index < count; index += 1) {
      const start = range.start + step * index;
      const clipRange = clampRange(
        { start, end: start + perClip },
        video.duration,
      );

      addJob(
        createJob({
          outputFileName: `${video.file.name.split(".")[0]}_clip${index + 1}_${batchStamp}.gif`,
          trimRange: clipRange,
          duration: perClip,
        }),
      );
    }

    toast.success(`Added ${count} clip${count > 1 ? "s" : ""} to the queue`);
  };

  const perClip = Math.min(clipDuration, selectedDuration);
  const maxDistinctClips = Math.max(
    1,
    Math.floor(selectedDuration / Math.max(perClip, 0.1)),
  );
  const effectiveClipCount = Math.min(
    Math.max(2, Math.round(clipCount)),
    maxDistinctClips,
  );

  const estimatedBytes = estimateGifBytes(
    mode === "clips" ? clipDuration : selectedDuration,
    outputWidth,
    settings.fps,
    settings.quality,
  );

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            { value: "simple", label: "Single", icon: Film },
            { value: "clips", label: "Batch", icon: Grid },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
              mode === value
                ? "bg-background text-primary shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 shrink-0 text-primary" />
        <h3 className="font-semibold">Output settings</h3>
      </div>

      <div className="space-y-2">
        <Label>Encoder</Label>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
          role="group"
          aria-label="GIF encoder"
        >
          {(
            [
              { value: "browser", label: "Browser" },
              { value: "ffmpeg", label: "FFmpeg" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={engine === option.value}
              onClick={() => setEngine(option.value)}
              className={cn(
                "rounded-lg py-2 text-xs font-medium transition-colors",
                engine === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {engine === "browser"
            ? "Starts instantly, no download. Best for short clips and flat graphics."
            : "Best for photographic video and long clips. Downloads FFmpeg on first use."}
        </p>
      </div>

      <div className="space-y-6">
        {mode === "clips" && (
          <div className="space-y-5 rounded-xl border bg-muted/40 p-4">
            <div className="space-y-3">
              <label className="flex justify-between text-sm font-medium">
                <span>Clips</span>
                <span className="text-primary">{clipCount}</span>
              </label>
              <Slider
                min={2}
                max={20}
                step={1}
                value={[clipCount]}
                onValueChange={(value) => setClipCount(value[0])}
                className="py-1"
              />
            </div>

            <div className="space-y-3">
              <label className="flex justify-between text-sm font-medium">
                <span>Duration per clip</span>
                <span className="text-primary">{formatTime(clipDuration)}</span>
              </label>
              <Slider
                min={0.5}
                max={Math.max(0.5, Math.min(selectedDuration, 10))}
                step={0.5}
                value={[Math.min(clipDuration, Math.max(0.5, selectedDuration))]}
                onValueChange={(value) =>
                  setClipDuration(Math.min(value[0], selectedDuration))
                }
                className="py-1"
              />
              <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
                <span>0.5s</span>
                <span>Max: {formatTime(Math.min(selectedDuration, 10))}</span>
              </div>
            </div>

            <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
              {effectiveClipCount} clip
              {effectiveClipCount > 1 ? "s" : ""} of{" "}
              {Math.min(clipDuration, selectedDuration).toFixed(1)}s across{" "}
              {formatTime(selectedDuration)}.
              {effectiveClipCount < clipCount
                ? " Fewer clips fit in this selection."
                : ""}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="resolution">Resolution</Label>
          <Select
            value={String(settings.width)}
            onValueChange={(value) =>
              setSettings({
                ...settings,
                width: value === "auto" ? "auto" : Number(value),
              })
            }
          >
            <SelectTrigger id="resolution" className="h-10 w-full md:h-8">
              <SelectValue placeholder="Select resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                Original ({video.width}px)
              </SelectItem>
              {RESOLUTIONS.map((width) => (
                <SelectItem key={width} value={width.toString()}>
                  {width}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center justify-between text-sm">
            <span>Frame rate</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={settings.fps}
              aria-label="Frames per second"
              onChange={(event) => {
                const value = Number(event.target.value);
                setSettings({
                  ...settings,
                  fps: Number.isFinite(value)
                    ? Math.min(60, Math.max(1, Math.round(value)))
                    : 15,
                });
              }}
              className="h-9 w-20 text-center md:h-8 md:w-16"
            />
          </Label>
          <Slider
            step={1}
            min={1}
            max={60}
            value={[settings.fps]}
            onValueChange={(value) =>
              setSettings({ ...settings, fps: Number(value[0]) })
            }
            className="py-2"
          />
        </div>

        <div className="space-y-2">
          <Label>Quality</Label>
          <div
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
            role="group"
            aria-label="GIF quality"
          >
            {(["low", "medium", "high"] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                aria-pressed={settings.quality === quality}
                onClick={() => setSettings({ ...settings, quality })}
                className={cn(
                  "rounded-lg py-2 text-xs font-medium capitalize transition-colors",
                  settings.quality === quality
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <Button
          size="lg"
          className="h-11 w-full text-sm"
          onClick={mode === "simple" ? handleGenerate : handleGenerateBatch}
          disabled={tooShort}
        >
          {mode === "simple"
            ? "Create GIF"
            : `Create ${effectiveClipCount} GIF${effectiveClipCount > 1 ? "s" : ""}`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {tooShort
            ? "Select at least 0.1s of video to continue."
            : `${selectedDuration.toFixed(1)}s · ~${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB estimated`}
        </p>
      </div>

      <JobList />
    </div>
  );
}
