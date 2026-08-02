import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useJobStore } from "../../store/useJobStore";
import { useJobProcessorContext } from "../../hooks/JobProcessorContext";
import { JobCard } from "./JobCard";

export function JobList() {
  const jobs = useJobStore((state) => state.jobs);
  const clearCompleted = useJobStore((state) => state.clearCompleted);
  const isProcessing = useJobStore((state) => state.isProcessing);
  const requeueJob = useJobStore((state) => state.requeueJob);
  const removeJob = useJobStore((state) => state.removeJob);
  const { handleCancelJob } = useJobProcessorContext();

  if (jobs.length === 0) return null;

  const handleDownload = async (url: string, filename: string) => {
    try {
      const blob = await fetch(url).then((response) => {
        if (!response.ok) throw new Error("The GIF is no longer available.");
        return response.blob();
      });
      const { saveAs } = await import("file-saver");
      saveAs(blob, filename);
      toast.success("Download started");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Download failed.",
      );
    }
  };

  const handleDownloadAll = async () => {
    const completed = jobs.filter(
      (job) => job.status === "completed" && job.resultUrl,
    );
    if (completed.length === 0) return;

    const toastId = toast.loading("Zipping GIFs…");

    try {
      const [{ default: JSZip }, { saveAs }] = await Promise.all([
        import("jszip"),
        import("file-saver"),
      ]);
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (const job of completed) {
        if (!job.resultUrl) continue;

        const response = await fetch(job.resultUrl);
        if (!response.ok) continue;

        // Two batch clips can be created in the same millisecond, so make the
        // archive names unique instead of overwriting one another.
        let name = job.outputFileName;
        let suffix = 2;
        while (usedNames.has(name)) {
          name = job.outputFileName.replace(/\.gif$/i, `_${suffix}.gif`);
          suffix += 1;
        }
        usedNames.add(name);

        zip.file(name, await response.blob());
      }

      if (usedNames.size === 0) {
        toast.error("No finished GIFs to download.", { id: toastId });
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "gifs.zip");
      toast.success(`Downloaded ${usedNames.size} GIFs`, { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the archive.",
        { id: toastId },
      );
    }
  };

  const handleClearAll = () => {
    const count = jobs.filter(
      (job) =>
        job.status === "completed" ||
        job.status === "cancelled" ||
        job.status === "error",
    ).length;

    clearCompleted();
    if (count > 0) {
      toast.info(`Cleared ${count} job${count > 1 ? "s" : ""}`);
    }
  };

  const hasFinished = jobs.some(
    (job) =>
      job.status === "completed" ||
      job.status === "cancelled" ||
      job.status === "error",
  );

  return (
    <div className="mt-6 space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          Queue
          {isProcessing && (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
        </h4>

        {hasFinished && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              Clear all
            </button>

            {jobs.some((job) => job.status === "completed") && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="rounded-md border border-primary/40 px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
              >
                Download all
              </button>
            )}
          </div>
        )}
      </div>

      <div className="max-h-[45dvh] space-y-3 overflow-y-auto overscroll-contain pr-1 sm:max-h-[400px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {jobs
            .slice()
            .reverse()
            .map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
              >
                <JobCard
                  job={job}
                  onCancel={handleCancelJob}
                  onDownload={handleDownload}
                  onRetry={(id) => {
                    requeueJob(id);
                    toast.info("Job re-queued");
                  }}
                  onRemove={(id) => {
                    removeJob(id);
                    toast.info("Job dismissed");
                  }}
                />
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
