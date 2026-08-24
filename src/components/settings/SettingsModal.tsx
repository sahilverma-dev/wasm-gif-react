import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  Github,
  Globe,
  Monitor,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function SettingsModal() {
  const { theme, setTheme } = useTheme();
  const removeLimits = useSettingsStore((state) => state.removeLimits);
  const toggleRemoveLimits = useSettingsStore(
    (state) => state.toggleRemoveLimits,
  );
  const showLogs = useSettingsStore((state) => state.showLogs);
  const toggleShowLogs = useSettingsStore((state) => state.toggleShowLogs);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label>Appearance</Label>
            <div
              className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
              role="group"
              aria-label="Theme"
            >
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium transition-colors",
                    theme === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              System follows your device setting.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-base">Remove limits</Label>
                <p className="text-xs text-muted-foreground">
                  Longer videos, larger files (experimental)
                </p>
              </div>
              <Switch
                checked={removeLimits}
                onCheckedChange={toggleRemoveLimits}
                aria-label="Remove upload limits"
              />
            </div>

            {removeLimits && (
              <Alert variant="destructive" className="py-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="ml-2 font-semibold">
                  High resource usage
                </AlertTitle>
                <AlertDescription className="mt-1 ml-2 text-xs">
                  Removing limits can freeze or crash low-memory devices. It
                  allows unlimited imports, file sizes, resolutions and clips.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-base">Show logs</Label>
                <p className="text-xs text-muted-foreground">
                  Display FFmpeg output while converting
                </p>
              </div>
              <Switch
                checked={showLogs}
                onCheckedChange={toggleShowLogs}
                aria-label="Show FFmpeg logs"
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground">About</h4>
            <a
              href="https://github.com/sahilverma-dev/wasm-gif-react"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm leading-none font-medium">GitHub</p>
                  <p className="text-xs text-muted-foreground">
                    View the source code
                  </p>
                </div>
              </div>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </a>
            <p className="px-1 text-[11px] text-muted-foreground">
              GIF.WASM runs FFmpeg WebAssembly locally. Your videos are never
              uploaded.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
