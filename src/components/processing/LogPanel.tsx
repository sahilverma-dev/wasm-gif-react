import { useEffect, useRef } from "react";
import { Clipboard, Filter, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useLogStore } from "../../store/useLogStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function LogPanel() {
  const logs = useLogStore((state) => state.logs);
  const clearLogs = useLogStore((state) => state.clearLogs);
  const isEnabled = useLogStore((state) => state.isEnabled);
  const setLoggingEnabled = useLogStore((state) => state.setLoggingEnabled);
  const filter = useLogStore((state) => state.filter);
  const setFilter = useLogStore((state) => state.setFilter);
  const showLogs = useSettingsStore((state) => state.showLogs);

  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  const filteredLogs = filter
    ? logs.filter((log) =>
        log.message.toLowerCase().includes(filter.toLowerCase()),
      )
    : logs;

  // Only follow new output while the user is already at the bottom, so
  // scrolling up to read an error is not yanked back.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && shouldStickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [filteredLogs.length, isEnabled]);

  const handleCopy = async () => {
    try {
      const text = filteredLogs
        .map(
          (log) =>
            `[${new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}] ${log.message}`,
        )
        .join("\n");
      await navigator.clipboard.writeText(text);
      toast.success("Logs copied");
    } catch {
      toast.error("Could not copy logs");
    }
  };

  if (!showLogs) return null;

  return (
    <section className="flex min-h-[240px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 p-2">
        <div className="flex items-center gap-2">
          <h3 className="pl-1 text-sm font-semibold">FFmpeg logs</h3>
          <span className="rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {filteredLogs.length}
          </span>
          {!isEnabled && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
              Paused
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleCopy}
            aria-label="Copy logs"
            title="Copy logs"
            className="size-9 md:size-8"
          >
            <Clipboard className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLoggingEnabled(!isEnabled)}
            className="h-9 md:h-8"
            aria-pressed={isEnabled}
          >
            {isEnabled ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={clearLogs}
            aria-label="Clear logs"
            title="Clear logs"
            className="size-9 md:size-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-b bg-muted/10 p-2">
        <div className="relative">
          <Filter className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter logs…"
            aria-label="Filter logs"
            className="h-10 bg-muted/20 pl-8 text-base md:h-8 md:text-xs"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {filter && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-8 w-8"
              onClick={() => setFilter("")}
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="off"
        aria-label="FFmpeg output"
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldStickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            32;
        }}
        className="max-h-[45dvh] min-h-[160px] flex-1 space-y-0.5 overflow-y-auto overscroll-contain bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300 sm:max-h-[500px] sm:text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center text-muted-foreground/60 italic">
            {isEnabled ? "No logs yet…" : "Logging is paused"}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="shrink-0 select-none text-zinc-500">
                {new Date(log.timestamp).toLocaleTimeString([], {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                className={cn(
                  "break-words",
                  log.type === "error" && "font-bold text-red-400",
                  log.type === "ffmpeg" && "text-blue-300/80",
                  log.type === "info" && "text-green-300/80",
                )}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
