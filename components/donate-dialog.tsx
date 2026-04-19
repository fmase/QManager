"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// =============================================================================
// DonateDialog — Donation links triggered from sidebar
// =============================================================================

// GitHub Sponsors icon — not available in lucide-react
const GitHubSponsorsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

interface DonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DonateDialog = ({ open, onOpenChange }: DonateDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Donate to QManager
          </DialogTitle>
          <DialogDescription>
            Support the development of this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm text-pretty font-medium leading-relaxed">
          <p>Hi, I&apos;m Rus 👋</p>
          <p>
            QuecManager is a little side project I maintain for free as part
            of Cameron&apos;s Toolkit. If you&apos;ve found it useful,
            consider supporting it with a small donation &mdash; it means a
            lot and keeps me going.
          </p>
          <p>Thanks so much for being awesome! 💙</p>
        </div>
        <div className="mt-2 grid gap-3">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              GCash via Remitly
            </h3>
            <p className="text-sm font-semibold">Russel Yasol</p>
            <p className="text-sm font-semibold tabular-nums">+639544817486</p>
          </div>
        </div>
        <DialogFooter className="flex flex-row items-start gap-2 sm:justify-start">
          <Button
            asChild
            size="sm"
            className="bg-[#EA4AAA] hover:bg-[#d03d97] text-white"
          >
            <a
              href="https://github.com/sponsors/dr-dolomite"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubSponsorsIcon className="size-4" />
              Sponsor on GitHub
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DonateDialog;
