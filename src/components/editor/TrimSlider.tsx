import * as React from "react";
import { Slider } from "../../components/ui/slider";
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
  const [localValue, setLocalValue] = React.useState([startTime, endTime]);

  // Sync local value when props change externally
  React.useEffect(() => {
    setLocalValue([startTime, endTime]);
  }, [startTime, endTime]);

  const handleChange = (newValues: number[]) => {
    // Prevent crossing or too short?
    // For now trust the slider
    setLocalValue(newValues);
    onValueChange(newValues[0], newValues[1]);
  };

  return (
    <div className={`w-full space-y-2 ${className}`}>
      <div className="flex justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <span>Start: {formatTime(localValue[0])}</span>
        <span className="text-primary">
          Duration: {formatTime(localValue[1] - localValue[0])}
        </span>
        <span>End: {formatTime(localValue[1])}</span>
      </div>

      <Slider
        disabled={isProcessing}
        value={localValue}
        min={0}
        max={duration}
        step={0.1}
        minStepsBetweenThumbs={1}
        onValueChange={handleChange}
        className="py-2 md:py-4 cursor-pointer"
      />

      {/* Visual Timeline Bar (placeholder for future waveforms) */}
      <div className="h-2 w-full bg-muted rounded-full relative overflow-hidden -mt-5 -z-10 pointer-events-none">
        <div
          className="absolute top-0 bottom-0 bg-primary/20 h-full"
          style={{
            left: `${(localValue[0] / duration) * 100}%`,
            right: `${100 - (localValue[1] / duration) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
