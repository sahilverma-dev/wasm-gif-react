import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BookOpen, Rocket } from "lucide-react";

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialModal({ open, onOpenChange }: TutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            How to Use
          </DialogTitle>
          <DialogDescription>
            Master the art of GIF making with wasm-gif
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <section className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              🎥 Multi-Video Support
            </h4>
            <p className="text-sm text-muted-foreground">
              Import multiple videos at once. You can process them individually
              or batch them together.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              ✂️ Advanced Clipping
            </h4>
            <p className="text-sm text-muted-foreground">
              Create multiple clips from a single video. Adjust start and end
              times with precision.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              ⚙️ Customization
            </h4>
            <p className="text-sm text-muted-foreground">
              Fine-tune your GIFs with custom resolutions and FPS settings to
              balance quality and file size.
            </p>
          </section>

          <section className="space-y-2 bg-muted/50 p-3 rounded-lg border border-muted">
            <h4 className="font-medium flex items-center gap-2 text-primary">
              <Rocket className="w-4 h-4" />
              Power User Features
            </h4>
            <p className="text-sm text-muted-foreground">
              By default, the app applies safe limits for smooth performance on
              mostly all devices. Need more power? You can remove these limits
              in <strong>Settings</strong> to unlock:
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground mt-2 ml-1 space-y-1">
              <li>Unlimited imported videos</li>
              <li>Higher file size limits</li>
              <li>Uncapped FPS and resolution</li>
              <li>Unlimited clips per video</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
