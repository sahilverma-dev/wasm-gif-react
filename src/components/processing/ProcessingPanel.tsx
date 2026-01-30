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
    <div className="bg-card border-x-0 md:border md:rounded-2xl p-4 md:p-6 shadow-sm md:shadow-md space-y-5 h-fit max-w-md mx-auto">
      {/* Header - Compact for Mobile */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg tracking-tight">Export Settings</h3>
        </div>
        {/* Mobile-friendly badge for estimated size */}
        <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary px-2 py-1 rounded-full text-secondary-foreground">
          ~{(video.duration * settings.fps * 0.05).toFixed(1)} MB
        </span>
      </div>

      {/* Mode Switcher - Full Width for Thumbs */}
      <div className="p-1 bg-muted rounded-xl flex gap-1">
        <button
          onClick={() => setMode("simple")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-lg transition-all",
            mode === "simple"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground active:bg-background/40",
          )}
        >
          <Film className="w-4 h-4" />
          Single
        </button>
        <button
          onClick={() => setMode("clips")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-lg transition-all",
            mode === "clips"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground active:bg-background/40",
          )}
        >
          <Grid className="w-4 h-4" />
          Batch
        </button>
      </div>

      <div className="space-y-5">
        {/* Batch Configuration - Stacked neatly for mobile */}
        {mode === "clips" && (
          <div className="space-y-5 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Clip Count
                </Label>
                <span className="text-sm font-bold text-primary">
                  {clipCount} clips
                </span>
              </div>
              <Slider
                min={2}
                max={10}
                step={1}
                value={[clipCount]}
                onValueChange={([val]) => setClipCount(val)}
                className="py-2" // Larger touch target
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Length
                </Label>
                <span className="text-sm font-bold text-primary">
                  {formatTime(clipDuration)}
                </span>
              </div>
              <Slider
                min={0.5}
                max={5}
                step={0.5}
                value={[clipDuration]}
                onValueChange={([val]) => setClipDuration(val)}
                className="py-2"
              />
            </div>
          </div>
        )}

        {/* Technical Specs Group */}
        <div className="grid grid-cols-1 gap-5">
          <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
            <Label htmlFor="resolution" className="font-semibold text-sm">
              Resolution
            </Label>
            <Select
              defaultValue={"720"}
              onValueChange={(val) =>
                setSettings({ ...settings, width: Number(val) })
              }
            >
              <SelectTrigger
                id="resolution"
                className="w-[110px] h-9 bg-background"
              >
                <SelectValue />
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

          <div className="space-y-4 px-1">
            <div className="flex justify-between items-end">
              <Label className="font-semibold text-sm">Frame Rate (FPS)</Label>
              <span className="text-sm font-bold text-primary">
                {settings.fps}
              </span>
            </div>
            <Slider
              min={15}
              max={60} // Capping at 60 for mobile performance
              step={1}
              value={[settings.fps]}
              onValueChange={([val]) => setSettings({ ...settings, fps: val })}
              className="py-2"
            />
          </div>
        </div>
      </div>

      {/* Sticky-ready Action Button */}
      <div className="pt-2">
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform"
          onClick={mode === "simple" ? handleGenerate : generateBatch}
        >
          {mode === "simple" ? "Create GIF" : `Create ${clipCount} GIFs`}
        </Button>
        <p className="text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-widest font-medium">
          Processing happens in browser
        </p>
      </div>

      <JobList />
    </div>
  );
}
