import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "../ui/button";

interface WorkerErrorScreenProps {
  error: string;
}

export function WorkerErrorScreen({ error }: WorkerErrorScreenProps) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-6 p-4 text-center animate-in fade-in duration-500">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">System Error</h1>
        <p className="text-muted-foreground">
          We encountered a critical error while loading the video processing
          engine.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm font-mono text-muted-foreground break-all max-w-lg">
        {error}
      </div>

      <Button onClick={handleReload} size="lg" className="gap-2">
        <RefreshCcw className="w-4 h-4" />
        Reload Application
      </Button>
    </div>
  );
}
