import { useJobStore } from "../../store/useJobStore";
import { Loader2, Check, Download, AlertTriangle, X } from "lucide-react";
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
      (j) => j.status === "completed" && j.resultUrl
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
    <div className="space-y-4 mt-6 border-t pt-6">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Processing Queue</h4>
        <div className="flex gap-3">
          {hasCompleted && (
            <button
              onClick={clearCompleted}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear Done
            </button>
          )}
          {hasCompleted && (
            <button
              onClick={handleDownloadAll}
              className="text-xs text-primary hover:underline"
            >
              Download All (ZIP)
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {jobs
          .slice()
          .reverse()
          .map((job) => (
            <div
              key={job.id}
              className="bg-muted/40 rounded-lg p-3 text-sm flex items-center justify-between gap-3 group"
            >
              {/* Icon / Status */}
              <div className="flex items-center gap-3 overflow-hidden">
                {job.status === "processing" && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                )}
                {job.status === "pending" && (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                {job.status === "completed" && (
                  <div className="shrink-0">
                    {job.resultUrl ? (
                      <img
                        src={job.resultUrl}
                        className="w-8 h-8 rounded object-cover bg-black/10 border"
                        alt=""
                      />
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                )}
                {job.status === "error" && (
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                )}

                <div className="truncate">
                  <p className="truncate font-medium">{job.outputFileName}</p>
                  {job.status === "processing" && (
                    <div className="h-1 w-24 bg-muted-foreground/20 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {job.status === "completed" && job.resultUrl && (
                  <button
                    onClick={() =>
                      handleDownload(job.resultUrl!, job.outputFileName)
                    }
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}

                {(job.status === "pending" || job.status === "processing") && (
                  <button
                    onClick={() => cancelJob(job.id)}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
