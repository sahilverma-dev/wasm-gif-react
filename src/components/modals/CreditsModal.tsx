import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Heart, ExternalLink, Code2, Palette, Cpu, Globe } from "lucide-react";
import { motion } from "motion/react";

interface CreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  {
    title: "Core Power",
    icon: <Cpu className="w-4 h-4 text-orange-500" />,
    items: [
      {
        name: "ffmpeg.wasm",
        url: "https://ffmpegwasm.netlify.app",
        desc: "Media Processing",
      },
      {
        name: "WebAssembly",
        url: "https://webassembly.org",
        desc: "Performance",
      },
      { name: "Vite", url: "https://vitejs.dev", desc: "Build Tool" },
    ],
  },
  {
    title: "Interface",
    icon: <Palette className="w-4 h-4 text-purple-500" />,
    items: [
      { name: "React", url: "https://react.dev", desc: "UI Library" },
      { name: "Tailwind CSS", url: "https://tailwindcss.com", desc: "Styling" },
      { name: "shadcn/ui", url: "https://ui.shadcn.com", desc: "Components" },
    ],
  },
  {
    title: "Ecosystem",
    icon: <Code2 className="w-4 h-4 text-blue-500" />,
    items: [
      {
        name: "TypeScript",
        url: "https://www.typescriptlang.org",
        desc: "Type Safety",
      },
      { name: "Vercel", url: "https://vercel.com", desc: "Deployment" },
    ],
  },
];

export function CreditsModal({ open, onOpenChange }: CreditsModalProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-linear-to-br from-background to-muted/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Heart className="w-6 h-6 text-red-500 fill-red-500 animate-pulse" />
            Credits
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-lg">
              Crafted with{" "}
              <span className="text-foreground font-medium">passion</span> and
              open source magic.
            </p>
          </div>

          <motion.div
            className="grid sm:grid-cols-3 gap-6"
            variants={container}
            initial="hidden"
            animate={open ? "show" : "hidden"}
          >
            {categories.map((category) => (
              <div key={category.title} className="space-y-4">
                <div className="flex items-center gap-2 font-semibold text-foreground/80 pb-2 border-b">
                  {category.icon}
                  {category.title}
                </div>
                <div className="space-y-3">
                  {category.items.map((tech) => (
                    <motion.a
                      key={tech.name}
                      href={tech.url}
                      target="_blank"
                      rel="noreferrer"
                      variants={item}
                      className="group flex items-center justify-between p-2.5 rounded-lg bg-card border hover:border-primary/50 hover:shadow-md transition-all duration-300"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {tech.name}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          {tech.desc}
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          <div className="flex flex-col items-center justify-center pt-6 border-t gap-2">
            <p className="text-sm text-muted-foreground">Designed & Built by</p>
            <a
              href="https://sahilverma.dev/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors text-sm font-medium"
            >
              <Globe className="w-4 h-4" />
              Sahil Verma
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
