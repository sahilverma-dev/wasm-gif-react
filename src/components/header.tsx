import { useState } from "react";
import { Heart, HelpCircle, Infinity as InfinityIcon } from "lucide-react";
import { SettingsModal } from "./settings/SettingsModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditsModal } from "./modals/CreditsModal";
import { TutorialModal } from "./modals/TutorialModal";
import { useSettingsStore } from "@/store/useSettingsStore";

const Header = () => {
  const [showCredits, setShowCredits] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const removeLimits = useSettingsStore((state) => state.removeLimits);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <a
          href="/"
          className="flex min-w-0 items-center gap-2 py-2 font-bold tracking-tight"
          aria-label="GIF.WASM home"
        >
          <img
            src="/logo.png"
            width={28}
            height={28}
            alt=""
            className="h-7 w-7 shrink-0"
          />
          <span className="truncate text-base sm:text-lg">GIF.WASM</span>
          {removeLimits && (
            <Badge
              variant="destructive"
              className="ml-1 hidden h-5 items-center gap-1 px-1.5 text-[10px] sm:flex"
            >
              <InfinityIcon className="h-3 w-3" />
              UNLIMITED
            </Badge>
          )}
        </a>

        <nav className="flex items-center gap-1" aria-label="Application">
          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-2 md:flex"
            onClick={() => setShowTutorial(true)}
          >
            <HelpCircle className="h-4 w-4" />
            How to use
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden"
            onClick={() => setShowTutorial(true)}
            aria-label="How to use"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-2 text-red-500 hover:bg-red-500/10 hover:text-red-600 md:flex"
            onClick={() => setShowCredits(true)}
          >
            <Heart className="h-4 w-4 fill-current" />
            Credits
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-red-500 md:hidden"
            onClick={() => setShowCredits(true)}
            aria-label="Credits"
          >
            <Heart className="h-5 w-5 fill-current" />
          </Button>

          <SettingsModal />
        </nav>
      </div>

      <CreditsModal open={showCredits} onOpenChange={setShowCredits} />
      <TutorialModal open={showTutorial} onOpenChange={setShowTutorial} />
    </header>
  );
};

export default Header;
