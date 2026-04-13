"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RestorePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (passphrase: string) => Promise<void>;
  incorrect?: boolean;
}

export function RestorePasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  incorrect,
}: RestorePasswordDialogProps) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(pw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enter backup passphrase</DialogTitle>
            <DialogDescription>
              This backup is encrypted. Enter the passphrase used when it was
              created.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Label htmlFor="restore-pw">Passphrase</Label>
            <Input
              id="restore-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
            {incorrect && (
              <p className="text-xs text-destructive">
                Incorrect passphrase. Check it and try again.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || pw.length === 0}>
              {busy ? "Decrypting…" : "Decrypt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
