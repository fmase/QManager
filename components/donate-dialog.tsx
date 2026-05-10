"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
          <p className="text-muted-foreground text-xs">
            You can also{" "}
            <a
              href="https://github.com/sponsors/dr-dolomite"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              sponsor on GitHub
            </a>
            .
          </p>
        </div>
        <div className="mt-2">
          <Button asChild size="sm" variant="outline">
            <a
              href="https://wise.com/pay/business/blackcatdev?currency=USD"
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate via Wise
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DonateDialog;
