import { useState } from "react";
import { SettingsModal } from "./settings/SettingsModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, HelpCircle, Infinity as InfinityIcon } from "lucide-react";
import { CreditsModal } from "./modals/CreditsModal";
import { TutorialModal } from "./modals/TutorialModal";
import { useSettingsStore } from "@/store/useSettingsStore";

const Header = () => {
  const [showCredits, setShowCredits] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { removeLimits } = useSettingsStore();

  return (
    <header className="container mx-auto px-4 py-4 flex items-center justify-between">
      <div className="font-bold text-lg tracking-tight flex items-center gap-2">
        <img src="./logo.png" className="size-6" alt="Logo" />
        GIF.WASM
        {removeLimits && (
          <Badge
            variant="destructive"
            className="hidden sm:flex items-center gap-1 text-[10px] h-5 px-1.5"
          >
            <InfinityIcon className="w-3 h-3" />
            UNLIMITED
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Mobile: Hide text, show icons only? Or just concise buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex gap-2"
          onClick={() => setShowTutorial(true)}
        >
          <HelpCircle className="w-4 h-4" />
          How to Use
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setShowTutorial(true)}
        >
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          onClick={() => setShowCredits(true)}
        >
          <Heart className="w-4 h-4 fill-current" />
          Credits
        </Button>

        <SettingsModal />
      </div>

      <CreditsModal open={showCredits} onOpenChange={setShowCredits} />
      <TutorialModal open={showTutorial} onOpenChange={setShowTutorial} />
    </header>
  );
};

export default Header;
