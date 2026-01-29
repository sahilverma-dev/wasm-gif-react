import { useEffect } from "react";
import { useJobStore } from "./store/useJobStore";
import { useVideoStore } from "./store/useVideoStore";
import { VideoUploader } from "./components/uploader/VideoUploader";
import { VideoList } from "./components/uploader/VideoList";
import { VideoPlayer } from "./components/editor/VideoPlayer";
import { ProcessingPanel } from "./components/processing/ProcessingPanel";
import { useJobProcessor } from "./hooks/useJobProcessor";
import { Toaster, toast } from "sonner";
import { cn } from "./lib/utils";

function App() {
  const isProcessing = useJobStore((state) => state.isProcessing);
  const { videos, activeVideoId } = useVideoStore();
  // Initialize background worker
  const { workerError } = useJobProcessor();

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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 flex flex-col">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-linear-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              GifCraft
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              Beta
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 flex flex-col gap-8 max-w-6xl">
        {/* Intro / Empty State */}
        {videos.length === 0 ? (
          <div className="flex flex-col flex-1 items-center justify-center min-h-[60vh] gap-8 animate-in fade-in zoom-in-95 duration-500">
            <section className="flex flex-col gap-2 text-center">
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
                Video to <span className="text-primary">GIF</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
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
            <div className="grid lg:grid-cols-3 gap-8">
              <div
                className={cn(
                  "lg:col-span-2 space-y-6",
                  !activeVideoId && "lg:col-span-3"
                )}
              >
                {activeVideoId ? (
                  <VideoPlayer />
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
              {/* Fallback uploader if list is not empty but small? */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Add more files:
                </p>
                <VideoUploader />
              </div>
            </div>
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
  );
}

export default App;
