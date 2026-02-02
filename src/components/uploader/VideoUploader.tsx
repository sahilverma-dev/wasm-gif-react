import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useVideoStore } from "../../store/useVideoStore";
import { getMetadata } from "../../lib/video-utils";
import { type VideoFile } from "../../types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useSettingsStore } from "../../store/useSettingsStore";

export function VideoUploader() {
  const addVideos = useVideoStore((state) => state.addVideos);
  const { removeLimits } = useSettingsStore();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newVideos: VideoFile[] = [];
      const errors: string[] = [];

      // Process files sequentially
      for (const file of acceptedFiles) {
        if (!removeLimits && file.size > 100 * 1024 * 1024) {
          // 100MB limit
          errors.push(`${file.name}: File too large (Max 100MB)`);
          continue;
        }

        try {
          const metadata = await getMetadata(file);

          if (!removeLimits && metadata.duration > 60) {
            errors.push(`${file.name}: Video too long (Max 60s)`);
            continue;
          }

          newVideos.push({
            id: uuidv4(),
            file,
            blobUrl: URL.createObjectURL(file), // Still useful for player
            ...metadata,
            trim: { start: 0, end: metadata.duration },
            clips: [],
          });
        } catch {
          errors.push(`${file.name}: Failed to load video`);
        }
      }

      if (newVideos.length > 0) {
        addVideos(newVideos);
        toast.success(
          `Added ${newVideos.length} video${newVideos.length > 1 ? "s" : ""}`,
        );
      }

      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }
    },
    [addVideos, removeLimits],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".webm"],
    },
    maxFiles: removeLimits ? undefined : 10,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300
        flex flex-col items-center justify-center p-12 text-center cursor-pointer
        ${
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }
      `}
    >
      <input {...getInputProps()} />

      <div className="z-10 bg-background/50 p-4 rounded-full mb-4 border shadow-sm group-hover:scale-110 transition-transform duration-300">
        <Upload
          className={`w-8 h-8 ${
            isDragActive ? "text-primary" : "text-muted-foreground"
          }`}
        />
      </div>

      <h3 className="text-lg font-semibold mb-1">
        {isDragActive ? "Drop videos here" : "Drag & drop videos"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
        {removeLimits ? (
          <span className="text-yellow-500 font-medium">
            Unlimited files, size & duration.
          </span>
        ) : (
          <>
            MP4, MOV, WebM up to 60s. <br />
            Max size 100MB per file.
          </>
        )}
      </p>

      <button className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
        Select Files
      </button>

      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,theme(colors.primary.DEFAULT/0.05)_0,transparent_70%)]" />
    </div>
  );
}
