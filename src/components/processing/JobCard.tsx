import {
  Loader2,
  Check,
  Download,
  AlertTriangle,
  X,
  FileVideo,
  Video,
  Film,
} from "lucide-react";
import type { ProcessingJob } from "../../types";

interface JobCardProps {
  job: ProcessingJob;
  onCancel: (id: string) => void;
  onDownload: (url: string, filename: string) => void;
}

export function JobCard({ job, onCancel, onDownload }: JobCardProps) {
  return (
    <div className="group rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex gap-4">
        {/* Status Icon Area */}
        <div className="shrink-0 pt-1">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border">
            {job.status === "processing" && (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            )}
            {job.status === "pending" && (
              <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            )}
            {job.status === "completed" &&
              (job.resultUrl ? (
                <img
                  src={job.resultUrl}
                  className="w-full h-full object-cover rounded-lg"
                  alt="GIF Preview"
                />
              ) : (
                <Check className="w-5 h-5 text-green-500" />
              ))}
            {job.status === "error" && (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title & Status Row */}
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p
                className="text-sm font-medium truncate"
                title={job.outputFileName}
              >
                {job.outputFileName}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {job.status === "completed" && (
                  <span className="text-green-500 font-medium">Completed</span>
                )}
                {job.status === "processing" && (
                  <span className="text-primary font-medium">
                    Processing...
                  </span>
                )}
                {job.status === "pending" && <span>Queued</span>}
                {job.status === "error" && (
                  <span className="text-destructive font-medium">Failed</span>
                )}
              </p>
            </div>
          </div>

          {/* Metadata Badges */}
          {(job.status === "completed" || job.status === "processing") && (
            <div className="flex flex-wrap gap-2">
              {/* Resolution */}
              {(job.resolution || job.settings.width) && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border">
                  <Video className="w-3 h-3" />
                  <span>
                    {job.resolution ||
                      (job.settings.width === "auto"
                        ? "Auto"
                        : `${job.settings.width}p`)}
                  </span>
                </div>
              )}
              {/* FPS */}
              {(job.fps || job.settings.fps) && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border">
                  <Film className="w-3 h-3" />
                  <span>{job.fps || job.settings.fps} FPS</span>
                </div>
              )}
              {/* Size */}
              {job.size && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border">
                  <FileVideo className="w-3 h-3" />
                  <span>{job.size}</span>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {job.error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
              {job.error}
            </p>
          )}

          {/* Progress Bar */}
          {job.status === "processing" && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Encoding...</span>
                <span>{Math.round(job.progress)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions - Right Side */}
        <div className="flex flex-col gap-2 shrink-0">
          {job.status === "completed" && job.resultUrl && (
            <button
              onClick={() => onDownload(job.resultUrl!, job.outputFileName)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {(job.status === "pending" || job.status === "processing") && (
            <button
              onClick={() => onCancel(job.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
