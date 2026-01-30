import { useState } from "react";
import { useVideoStore } from "../../store/useVideoStore";
import { useJobStore } from "../../store/useJobStore";
import { type GifSettings, type ProcessingJob } from "../../types";
import { Settings, Grid, Film } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { JobList } from "./JobList";
import { cn } from "../../lib/utils";
import { formatTime } from "../../lib/video-utils";
import { Button } from "../ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";

type Mode = "simple" | "clips";

// consts
const RESOLUTIONS = [144, 320, 480, 720, 1080];

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
    <div className="bg-card border rounded-2xl shadow-sm p-4 space-y-6 h-fit">
      {/* Mode Switcher */}
      <div className="grid grid-cols-2 rounded-xl bg-muted p-1 gap-1">
        <button
          onClick={() => setMode("simple")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all",
            mode === "simple"
              ? "bg-background shadow text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Film className="w-4 h-4" />
          Single
        </button>

        <button
          onClick={() => setMode("clips")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all",
            mode === "clips"
              ? "bg-background shadow text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Grid className="w-4 h-4" />
          Batch
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary shrink-0" />
          <h3 className="font-semibold text-base">Output Settings</h3>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-6">
        {/* Clip Controls */}
        {mode === "clips" && (
          <div className="rounded-xl border bg-muted/40 p-4 space-y-5">
            <div className="space-y-2">
              <label className="flex justify-between text-sm font-medium">
                <span>Clips</span>
                <span className="text-primary">{clipCount}</span>
              </label>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={clipCount}
                onChange={(e) => setClipCount(Number(e.target.value))}
                className="w-full accent-primary h-2"
              />
            </div>

            <div className="space-y-2">
              <label className="flex justify-between text-sm font-medium">
                <span>Duration</span>
                <span className="text-primary">{formatTime(clipDuration)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={clipDuration}
                onChange={(e) => setClipDuration(Number(e.target.value))}
                className="w-full accent-primary h-2"
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {clipCount} clips × {clipDuration}s each
            </p>
          </div>
        )}

        {/* Resolution */}
        <div className="space-y-2">
          <Label htmlFor="resolution" className="text-sm">
            Resolution
          </Label>
          <Select
            defaultValue="720"
            onValueChange={(e) =>
              setSettings({ ...settings, width: Number(e) })
            }
          >
            <SelectTrigger id="resolution" className="w-full h-11">
              <SelectValue placeholder="Select resolution" />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((w) => (
                <SelectItem key={w} value={w.toString()}>
                  {w}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* FPS */}
        <div className="space-y-2">
          <Label className="flex justify-between text-sm">
            <span>Frame Rate</span>
            <span className="text-primary">{settings.fps} FPS</span>
          </Label>
          <Slider
            step={1}
            min={15}
            max={120}
            value={[settings.fps]}
            onValueChange={(value) =>
              setSettings({
                ...settings,
                fps: Number(value[0]),
              })
            }
            className="py-2"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="pt-4 space-y-2">
        <Button
          size="lg"
          className="w-full h-12 text-base"
          onClick={mode === "simple" ? handleGenerate : generateBatch}
        >
          {mode === "simple" ? "Create GIF" : `Create ${clipCount} GIFs`}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Est. size ~{(video.duration * settings.fps * 0.05).toFixed(1)} MB
        </p>
      </div>

      {/* Jobs */}
      <JobList />
    </div>
  );
}
