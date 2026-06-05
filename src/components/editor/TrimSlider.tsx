import * as React from "react";
import { Slider } from "../ui/slider";
import { formatTime } from "../../lib/video-utils";

interface TrimSliderProps {
  duration: number;
  startTime: number;
  endTime: number;
  onValueChange: (start: number, end: number) => void;
  className?: string;
  isProcessing?: boolean;
}

export function TrimSlider({
  duration,
  startTime,
  endTime,
  onValueChange,
  className,
  isProcessing,
}: TrimSliderProps) {
  const safeDuration = Math.max(0.1, Number.isFinite(duration) ? duration : 0.1);

  const [localValue, setLocalValue] = React.useState([
    Math.min(startTime, safeDuration - 0.1),
    Math.max(Math.min(endTime, safeDuration), 0.1),
  ]);

  // Sync when the range changes from outside (new video, reset).
  React.useEffect(() => {
    setLocalValue([startTime, endTime]);
  }, [startTime, endTime]);

  const handleChange = (values: number[]) => {
    const next: [number, number] = [
      Math.max(0, Math.min(values[0], safeDuration - 0.1)),
      Math.max(0.1, Math.min(values[1], safeDuration)),
    ];

    if (next[1] - next[0] < 0.1) return;

    setLocalValue(next);
    onValueChange(next[0], next[1]);
  };

  return (
    <div className={`w-full space-y-2 ${className ?? ""}`}>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
        <span className="truncate">Start: {formatTime(localValue[0])}</span>
        <span className="truncate text-center text-primary">
          Length: {formatTime(localValue[1] - localValue[0])}
        </span>
        <span className="truncate text-right">
          End: {formatTime(localValue[1])}
        </span>
      </div>

      <Slider
        disabled={isProcessing}
        value={localValue}
        min={0}
        max={safeDuration}
        step={0.1}
        minStepsBetweenThumbs={1}
        onValueChange={handleChange}
        aria-label="Trim range"
        className="cursor-pointer py-3"
      />
    </div>
  );
}
