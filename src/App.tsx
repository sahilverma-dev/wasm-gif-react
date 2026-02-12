import { useEffect } from "react";
import { useJobStore } from "./store/useJobStore";
import { useVideoStore } from "./store/useVideoStore";
import { VideoUploader } from "./components/uploader/VideoUploader";
import { VideoList } from "./components/uploader/VideoList";
import { VideoPlayer } from "./components/editor/VideoPlayer";
import { ProcessingPanel } from "./components/processing/ProcessingPanel";
import { LogPanel } from "./components/processing/LogPanel";
import { useJobProcessor } from "./hooks/useJobProcessor";
import { JobProcessorContext } from "./hooks/JobProcessorContext";
import { Toaster, toast } from "sonner";
import { cn } from "./lib/utils";

import { Loader2 } from "lucide-react";
import { WorkerErrorScreen } from "./components/common/WorkerErrorScreen";

import { useMediaQuery } from "./hooks/useMediaQuery";
import Header from "./components/header";

function App() {
  const isProcessing = useJobStore((state) => state.isProcessing);
  const { videos, activeVideoId } = useVideoStore();
  const { workerError, isWorkerLoaded, handleCancelJob } = useJobProcessor();

  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (workerError) {
      toast.error("System Error", {
        description: workerError,
        duration: Infinity,
      });
    }
  }, [workerError]);

  // Prevent accidental tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessing) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isProcessing]);

  if (workerError) {
    return <WorkerErrorScreen error={workerError} />;
  }

  if (!isWorkerLoaded) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Loading FFmpeg Core...
        </p>
      </div>
    );
  }

  return (
    <JobProcessorContext.Provider value={{ handleCancelJob }}>
      <div className="min-h-dvh bg-background text-foreground font-sans selection:bg-primary/20 flex flex-col transition-colors duration-300">
        <Toaster
          position={isDesktop ? "bottom-left" : "top-center"}
          richColors
        />

        {/* Navbar / Header */}
        <Header />

        {/* Main Content */}
        <main className="container mx-auto md:px-4 p-2 md:py-4 flex-1 flex flex-col gap-8 max-w-6xl">
          {/* Intro / Empty State */}
          {videos.length === 0 ? (
            <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] gap-8 animate-in fade-in zoom-in-95 duration-500">
              <section className="flex flex-col gap-2 text-center">
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
                  Video to <span className="text-primary">GIF</span>
                </h1>
                <p className="text-muted-foreground text-sm md:text-lg max-w-xl mx-auto">
                  Private, client-side conversion. No uploads, no limits.
                </p>
              </section>
              <div className="w-full max-w-xl">
                <VideoUploader />
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              {/* Top Bar: Uploader (Small) + Stats? */}

              {/* Editor Section */}
              <div className="grid lg:grid-cols-3 gap-2 md:gap-8">
                <div
                  className={cn(
                    "lg:col-span-2 space-y-2 md:space-y-6",
                    !activeVideoId && "lg:col-span-3",
                  )}
                >
                  {activeVideoId ? (
                    <div className="space-y-6">
                      <VideoPlayer />
                    </div>
                  ) : (
                    <div className="h-64 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground bg-muted/20">
                      Select a video from the queue below to start editing
                    </div>
                  )}
                </div>

                {activeVideoId && (
                  <div className="lg:col-span-1">
                    <ProcessingPanel />
                  </div>
                )}
              </div>

              {/* Bottom Shelf: Queue */}
              <div className="border-t pt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Your Workspace</h3>
                  <div className="scale-75 origin-right">
                    {/* Mini Uploader could go here if needed */}
                  </div>
                </div>
                <VideoList />
              </div>
              <LogPanel />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t py-6 mt-auto">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Built with React, WASM & ❤️. 100% Client-Side.</p>
          </div>
        </footer>
      </div>
    </JobProcessorContext.Provider>
  );
}

export default App;
