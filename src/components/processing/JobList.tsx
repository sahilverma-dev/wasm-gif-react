import { useJobStore } from "../../store/useJobStore";
import { useJobProcessorContext } from "../../hooks/JobProcessorContext";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { JobCard } from "./JobCard";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function JobList() {
  const { jobs, clearCompleted, isProcessing, requeueJob, removeJob } =
    useJobStore();
  const { handleCancelJob } = useJobProcessorContext();

  if (jobs.length === 0) return null;

  const handleDownload = async (url: string, filename: string) => {
    const blob = await fetch(url).then((r) => r.blob());
    saveAs(blob, filename);
    toast.success("Download started");
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

  const handleRetry = (id: string) => {
    requeueJob(id);
    toast.info("Job re-queued");
  };

  const handleRemove = (id: string) => {
    removeJob(id);
    toast.info("Job dismissed");
  };

  const handleClearAll = () => {
    const count = jobs.filter(
      (j) =>
        j.status === "completed" ||
        j.status === "cancelled" ||
        j.status === "error",
    ).length;
    clearCompleted();
    if (count > 0) {
      toast.info(`Cleared ${count} job${count > 1 ? "s" : ""}`);
    }
  };

  const hasFinished = jobs.some(
    (j) =>
      j.status === "completed" ||
      j.status === "cancelled" ||
      j.status === "error",
  );

  return (
    <div className="mt-6 pt-6 border-t space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          Queue
          {isProcessing && (
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
          )}
        </h4>

        {hasFinished && (
          <div className="flex gap-2">
            <button
              onClick={handleClearAll}
              className="text-xs px-2 py-1 rounded-md border text-muted-foreground hover:text-destructive hover:border-destructive transition"
            >
              Clear All
            </button>

            {jobs.some((j) => j.status === "completed") && (
              <button
                onClick={handleDownloadAll}
                className="text-xs px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition"
              >
                Download All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Job List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {jobs
            .slice()
            .reverse()
            .map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <JobCard
                  job={job}
                  onCancel={handleCancelJob}
                  onDownload={handleDownload}
                  onRetry={handleRetry}
                  onRemove={handleRemove}
                />
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
