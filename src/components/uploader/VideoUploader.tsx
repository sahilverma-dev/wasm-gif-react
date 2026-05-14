import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload } from "lucide-react";
import { useVideoStore } from "../../store/useVideoStore";
import { toast } from "sonner";
import { useSettingsStore } from "../../store/useSettingsStore";
import { buildVideos } from "../../lib/video-files";

export function VideoUploader() {
  const addVideos = useVideoStore((state) => state.addVideos);
  const existingVideos = useVideoStore((state) => state.videos);
  const removeLimits = useSettingsStore((state) => state.removeLimits);
  const [isReading, setIsReading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsReading(true);
      try {
        const { videos, errors } = await buildVideos(acceptedFiles, {
          removeLimits,
          existing: existingVideos,
        });

        if (videos.length > 0) {
          addVideos(videos);
          toast.success(
            `Added ${videos.length} video${videos.length > 1 ? "s" : ""}`,
          );
        }

        errors.forEach((error) => toast.error(error));
      } finally {
        setIsReading(false);
      }
    },
    [addVideos, existingVideos, removeLimits],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".m4v"],
    },
    maxFiles: removeLimits ? undefined : 10,
    disabled: isReading,
    noKeyboard: true,
  });

  return (
    <div
      {...getRootProps()}
      role="button"
      tabIndex={0}
      aria-label="Add videos to convert to GIF"
      aria-busy={isReading}
      className={[
        "relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-colors outline-none sm:p-10",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40",
        "hover:border-primary/50 hover:bg-muted/30",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25",
      ].join(" ")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <input {...getInputProps()} />

      <div className="z-10 mb-4 rounded-full border bg-background/60 p-4 shadow-sm">
        {isReading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload
            className={`h-8 w-8 ${
              isDragActive ? "text-primary" : "text-muted-foreground"
            }`}
          />
        )}
      </div>

      <h3 className="mb-1 text-lg font-semibold">
        {isReading
          ? "Reading videos…"
          : isDragActive
            ? "Drop videos here"
            : "Drag & drop videos"}
      </h3>
      <p className="mx-auto mb-5 max-w-xs text-sm text-muted-foreground">
        {removeLimits ? (
          <span className="font-medium text-amber-500">
            Unlimited files, size & duration.
          </span>
        ) : (
          <>
            MP4, MOV, WebM up to 60s.
            <br />
            Max size 100MB per file.
          </>
        )}
      </p>

      <span
        aria-hidden="true"
        className="pointer-events-none inline-flex h-9 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20"
      >
        Select Files
      </span>

      <p className="mt-3 text-xs text-muted-foreground/70">
        Files never leave your device.
      </p>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,var(--color-primary)_0%,transparent_70%)] opacity-5" />
    </div>
  );
}
