import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "../ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort boundary: a render error in one panel should not leave the user
 * with a blank white page.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center"
        role="alert"
      >
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            The editor hit an unexpected error. Reloading usually fixes it — any
            videos you added are still on your device.
          </p>
        </div>
        <p className="max-w-lg overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs break-words text-muted-foreground">
          {error.message}
        </p>
        <Button
          size="lg"
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Reload application
        </Button>
      </div>
    );
  }
}
