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
  Settings,
  Github,
  Moon,
  Sun,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SettingsModal() {
  const { theme, setTheme } = useTheme();
  const { removeLimits, toggleRemoveLimits, showLogs, toggleShowLogs } =
    useSettingsStore();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Appearance */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Dark Mode</Label>
              <p className="text-xs text-muted-foreground">
                Adjust the appearance of the application
              </p>
            </div>
            <div className="flex bg-muted p-1 rounded-full">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-full ${theme === "light" ? "bg-background shadow-sm" : ""}`}
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-full ${theme === "dark" ? "bg-background shadow-sm" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Limits */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Remove Limits</Label>
                <p className="text-xs text-muted-foreground">
                  Process longer videos (Experimental)
                </p>
              </div>
              <Switch
                checked={removeLimits}
                onCheckedChange={toggleRemoveLimits}
              />
            </div>

            {removeLimits && (
              <Alert variant="destructive" className="py-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="ml-2 font-semibold">
                  High Resource Usage
                </AlertTitle>
                <AlertDescription className="text-xs ml-2 mt-1">
                  Disabling limits may cause the browser to crash or freeze.
                  This allows:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Unlimited imported videos</li>
                    <li>Uncapped file sizes & resolutions</li>
                    <li>Unlimited clip creation</li>
                    <li>Extended queue processing</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Logs */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Show Logs</Label>
                <p className="text-xs text-muted-foreground">
                  Display FFmpeg output (Logs for nerds 🤓)
                </p>
              </div>
              <Switch checked={showLogs} onCheckedChange={toggleShowLogs} />
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">About</h4>
            <div className="grid gap-2">
              <a
                href="https://github.com/sahilverma-dev/wasm-gif-react"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Github className="h-5 w-5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">GitHub</p>
                    <p className="text-xs text-muted-foreground">
                      View source code
                    </p>
                  </div>
                </div>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
