import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  Cpu,
  Download,
  ExternalLink,
  FileVideo,
  Film,
  Globe,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Video,
  X,
} from "lucide-react";
import type { ProcessingJob } from "../../types";

interface JobCardProps {
  job: ProcessingJob;
  onCancel: (id: string) => void;
  onDownload: (url: string, filename: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_LABEL: Record<ProcessingJob["status"], string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Completed",
  error: "Failed",
  cancelled: "Cancelled",
};

export function JobCard({
  job,
  onCancel,
  onDownload,
  onRetry,
  onRemove,
}: JobCardProps) {
  const isTerminal = job.status === "error" || job.status === "cancelled";
  const isDone = job.status === "completed";

  return (
    <div className="group rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex gap-3">
        <div className="shrink-0 pt-0.5">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {job.status === "processing" && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {job.status === "pending" && (
              <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
            )}
            {isDone &&
              (job.resultUrl ? (
                <a
                  href={job.resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/image relative block h-full w-full"
                  aria-label={`Open ${job.outputFileName}`}
                >
                  <img
                    src={job.resultUrl}
                    className="h-full w-full object-cover"
                    alt=""
                    loading="lazy"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/image:opacity-100">
                    <ExternalLink className="h-4 w-4 text-white" />
                  </span>
                </a>
              ) : (
                <Check className="h-5 w-5 text-emerald-500" />
              ))}
            {job.status === "error" && (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {job.status === "cancelled" && (
              <Ban className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p
                className="truncate text-sm font-medium"
                title={job.outputFileName}
              >
                {job.outputFileName}
              </p>
              <p
                aria-live="polite"
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  className={
                    isDone
                      ? "font-medium text-emerald-500"
                      : job.status === "processing"
                        ? "font-medium text-primary"
                        : job.status === "error"
                          ? "font-medium text-destructive"
                          : undefined
                  }
                >
                  {STATUS_LABEL[job.status]}
                </span>
              </p>
            </div>
          </div>

          {job.recoveryReason && (
            <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <span className="block font-semibold">Auto-recovered</span>
                <span className="opacity-90">
                  Retried with safer settings: {job.recoveryReason}
                </span>
              </div>
            </div>
          )}

          {(isDone || job.status === "processing") && (
            <div className="flex flex-wrap gap-1.5">
              <Badge icon={Video}>
                {job.resolution ||
                  (job.settings.width === "auto"
                    ? "Original"
                    : `${job.settings.width}px`)}
              </Badge>
              <Badge icon={Film}>{job.fps || job.settings.fps} FPS</Badge>
              {job.size && <Badge icon={FileVideo}>{job.size}</Badge>}
              <Badge
                icon={job.settings.engine === "ffmpeg" ? Cpu : Globe}
              >
                {job.settings.engine === "ffmpeg" ? "FFmpeg" : "Browser"}
              </Badge>
            </div>
          )}

          {job.error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
              {job.error}
            </p>
          )}

          {job.status === "processing" && (
            <div className="space-y-1">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(job.progress)}
                aria-label={`Converting ${job.outputFileName}`}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Encoding…</span>
                <span>{Math.round(job.progress)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-start gap-1 md:flex-col">
          {isDone && job.resultUrl && (
            <ActionButton
              label="Download GIF"
              onClick={() => onDownload(job.resultUrl!, job.outputFileName)}
            >
              <Download className="h-4 w-4" />
            </ActionButton>
          )}

          {(job.status === "pending" || job.status === "processing") && (
            <ActionButton
              label="Cancel job"
              onClick={() => onCancel(job.id)}
              tone="destructive"
            >
              <X className="h-4 w-4" />
            </ActionButton>
          )}

          {isTerminal && (
            <ActionButton label="Retry job" onClick={() => onRetry(job.id)}>
              <RotateCcw className="h-4 w-4" />
            </ActionButton>
          )}

          {(isTerminal || isDone) && (
            <ActionButton
              label="Remove job"
              onClick={() => onRemove(job.id)}
              tone="destructive"
            >
              <X className="h-4 w-4" />
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({
  icon: Icon,
  children,
}: {
  icon: typeof Video;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:text-xs">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  tone,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 md:h-8 md:w-8 ${
        tone === "destructive"
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
