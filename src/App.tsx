import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useJobStore } from "./store/useJobStore";
import { useVideoStore } from "./store/useVideoStore";
import { VideoUploader } from "./components/uploader/VideoUploader";
import { VideoList } from "./components/uploader/VideoList";
import { VideoPlayer } from "./components/editor/VideoPlayer";
import { ProcessingPanel } from "./components/processing/ProcessingPanel";
import { LogPanel } from "./components/processing/LogPanel";
import { useJobProcessor } from "./hooks/useJobProcessor";
import { JobProcessorContext } from "./hooks/JobProcessorContext";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { cn } from "./lib/utils";
import { WorkerErrorScreen } from "./components/common/WorkerErrorScreen";
import Header from "./components/header";

function useThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = resolvedTheme === "dark" ? "#171717" : "#ffffff";
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", color));
  }, [resolvedTheme]);
}

function App() {
  const isProcessing = useJobStore((state) => state.isProcessing);
  const hasVideos = useVideoStore((state) => state.videos.length > 0);
  const activeVideoId = useVideoStore((state) => state.activeVideoId);
  const { workerError, hasLoadedOnce, handleCancelJob } = useJobProcessor();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  useThemeColor();

  // Warn before losing in-memory work.
  useEffect(() => {
    if (!isProcessing) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isProcessing]);

  if (workerError) {
    return <WorkerErrorScreen error={workerError} />;
  }

  return (
    <JobProcessorContext.Provider value={{ handleCancelJob }}>
      <div className="flex min-h-dvh flex-col bg-background font-sans text-foreground selection:bg-primary/20">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <Toaster
          position={isDesktop ? "bottom-left" : "top-center"}
          richColors
          mobileOffset={{
            top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)",
          }}
        />

        <Header />

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-3 py-4 outline-none sm:gap-6 sm:px-4 sm:py-6"
        >
          <h1 className="sr-only">
            Video to GIF converter that runs entirely in your browser
          </h1>

          {!hasLoadedOnce && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm"
            >
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  Preparing the video engine…
                </span>{" "}
                You can add and trim videos while the encoder downloads.
              </p>
            </div>
          )}

          {!hasVideos ? (
            <div className="flex min-h-[calc(100dvh-16rem)] flex-1 animate-in flex-col items-center justify-center gap-6 fade-in duration-300 sm:gap-8">
              <section className="flex flex-col gap-2 text-center">
                <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                  Private by design
                </p>
                <p className="text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                  Video to <span className="text-primary">GIF</span>
                </p>
                <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base md:text-lg">
                  Convert clips without uploading anything. Trimming and
                  encoding happen on your device.
                </p>
              </section>
              <div className="w-full max-w-xl">
                <VideoUploader />
              </div>
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <li>100% in your browser</li>
                <li aria-hidden="true">·</li>
                <li>No sign-up</li>
                <li aria-hidden="true">·</li>
                <li>No watermarks</li>
              </ul>
            </div>
          ) : (
            <div className="animate-in space-y-6 fade-in slide-in-from-bottom-2 duration-300 sm:space-y-8">
              <div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
                <div
                  className={cn(
                    "space-y-4 lg:col-span-2 lg:space-y-6",
                    !activeVideoId && "lg:col-span-3",
                  )}
                >
                  {activeVideoId ? (
                    <VideoPlayer />
                  ) : (
                    <div className="flex h-56 items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                      Select a video from the queue to start editing
                    </div>
                  )}
                </div>

                {activeVideoId && (
                  <div className="lg:col-span-1">
                    <ProcessingPanel />
                  </div>
                )}
              </div>

              <div className="border-t pt-6 sm:pt-8">
                <VideoList />
              </div>
              <LogPanel />
            </div>
          )}
        </main>

        <footer className="mt-auto border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-center text-xs text-muted-foreground sm:text-sm">
            <p>Built with React, WebAssembly and care. 100% client-side.</p>
          </div>
        </footer>
      </div>
    </JobProcessorContext.Provider>
  );
}

export default App;
