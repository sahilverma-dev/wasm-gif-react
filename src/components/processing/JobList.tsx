import { useJobStore } from "../../store/useJobStore";
import {
  Loader2,
  Check,
  Download,
  AlertTriangle,
  X,
  ExternalLinkIcon,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";

export function JobList() {
  const { jobs, cancelJob, clearCompleted } = useJobStore();

  if (jobs.length === 0) return null;

  const handleDownload = async (url: string, filename: string) => {
    const blob = await fetch(url).then((r) => r.blob());
    saveAs(blob, filename);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const completed = jobs.filter(
      (j) => j.status === "completed" && j.resultUrl,
    );

    if (completed.length === 0) return;

    const toastId = toast.loading("Zipping files...");

    for (const job of completed) {
      if (job.resultUrl) {
        const blob = await fetch(job.resultUrl).then((r) => r.blob());
        zip.file(job.outputFileName, blob);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "gifs.zip");
    toast.dismiss(toastId);
    toast.success("Downloaded all GIFs");
  };

  const hasCompleted = jobs.some((j) => j.status === "completed");

  return (
    <div className="mt-6 pt-6 border-t space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Processing Queue</h4>

        {hasCompleted && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={clearCompleted}
              className="text-xs px-2 py-1 rounded-md border text-muted-foreground hover:text-destructive hover:border-destructive transition"
            >
              Clear Done
            </button>

            <button
              onClick={handleDownloadAll}
              className="text-xs px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition"
            >
              Download All (ZIP)
            </button>
          </div>
        )}
      </div>

      {/* Job List */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {jobs
          .slice()
          .reverse()
          .map((job) => (
            <div
              key={job.id}
              className="rounded-xl border bg-muted/40 p-3 space-y-3 text-sm"
            >
              {/* Top Row */}
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="pt-0.5 shrink-0">
                  {job.status === "processing" && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  {job.status === "pending" && (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  {job.status === "completed" &&
                    (job.resultUrl ? (
                      <div className="relative group shrink-0">
                        <a
                          href={job.resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open preview in new tab"
                          className="block"
                        >
                          <img
                            src={job.resultUrl}
                            alt=""
                            className="w-9 h-9 rounded-md object-cover border bg-black/10"
                          />

                          {/* Hover / Tap Overlay */}
                          <div
                            className="
        absolute inset-0 rounded-md
        bg-black/50
        flex items-center justify-center
        opacity-100 sm:opacity-0
        sm:group-hover:opacity-100
        transition-opacity
      "
                          >
                            <ExternalLinkIcon className="w-4 h-4 text-white" />
                          </div>
                        </a>
                      </div>
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    ))}
                  {job.status === "error" && (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  )}
                </div>

                {/* Filename + Progress */}
                <div className="md:min-w-0 flex-1">
                  <p
                    className="text-xs sm:text-sm font-normal sm:font-medium
              leading-snug sm:leading-normal
              line-clamp-2 sm:truncate"
                  >
                    {job.outputFileName}
                  </p>

                  {job.status === "processing" && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted-foreground/20 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                {job.status === "completed" && job.resultUrl && (
                  <button
                    onClick={() =>
                      handleDownload(job.resultUrl!, job.outputFileName)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}

                {(job.status === "pending" || job.status === "processing") && (
                  <button
                    onClick={() => cancelJob(job.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border text-muted-foreground hover:text-destructive hover:border-destructive transition"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
