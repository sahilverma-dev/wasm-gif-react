import { useLogStore } from "../../store/useLogStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Trash2, Filter } from "lucide-react";
import { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

export function LogPanel() {
  const { logs, clearLogs, isEnabled, setLoggingEnabled, filter, setFilter } =
    useLogStore();
  const { showLogs } = useSettingsStore();

  // We'll keep local state for open/close if it's a collapsible panel,
  // but let's assume it's displayed in the grid.
  // Per design, it's likely a dedicated section or a collapsible.
  // The prompt asked for "option to disable and clear log and filter".

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter((log) =>
    log.message.toLowerCase().includes(filter.toLowerCase()),
  );

  if (!showLogs) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-card border rounded-2xl shadow-sm overflow-hidden min-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm pl-1">FFmpeg Logs</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md border">
            {filteredLogs.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLoggingEnabled(!isEnabled)}
            className="h-8"
            title={isEnabled ? "Disable Logs" : "Enable Logs"}
          >
            {isEnabled ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={clearLogs}
            title="Clear Logs"
            className="size-8"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-2 border-b bg-muted/10">
        <div className="relative">
          <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter logs..."
            className="h-8 pl-8 text-xs bg-muted/20"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={() => setFilter("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Logs Area */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 space-y-1 font-mono text-[10px] sm:text-xs bg-black/90 text-zinc-300"
      >
        <ScrollArea className="max-h-[500px] overflow-y-auto">
          {!isEnabled && logs.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground/50 italic">
              Logging is disabled
            </div>
          )}

          {isEnabled && logs.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground/50 italic">
              No logs yet...
            </div>
          )}

          {filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="text-zinc-500 shrink-0 select-none">
                {new Date(log.timestamp).toLocaleTimeString([], {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                className={cn(
                  "break-all",
                  log.type === "error" && "text-red-400 font-bold",
                  log.type === "ffmpeg" && "text-blue-300/80",
                  log.type === "info" && "text-green-300/80",
                )}
              >
                {log.message}
              </span>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}
