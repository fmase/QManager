"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BACKUP_SECTIONS,
  computeDisabledKeys,
  initialSelection,
  selectedKeys,
} from "@/lib/config-backup/sections";
import { useConfigBackup } from "@/hooks/use-config-backup";

const MIN_PASSPHRASE_LEN = 10;

const ConfigBackupCard = () => {
  const [selection, setSelection] = useState(initialSelection());
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { runBackup, stage, reset } = useConfigBackup();

  const disabled = useMemo(() => computeDisabledKeys(selection), [selection]);
  const chosen = useMemo(() => selectedKeys(selection), [selection]);

  const passphraseOk =
    passphrase.length >= MIN_PASSPHRASE_LEN && passphrase === confirm;
  const busy =
    stage === "collecting" || stage === "encrypting" || stage === "downloading";
  const canDownload = chosen.length > 0 && passphraseOk && !busy;

  const buttonLabel =
    stage === "collecting"
      ? "Collecting…"
      : stage === "encrypting"
      ? "Encrypting…"
      : stage === "downloading"
      ? "Downloading…"
      : "Download Backup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDownload) return;
    reset();
    const result = await runBackup(chosen, passphrase);
    if (result.ok) {
      toast.success("Backup downloaded");
      setPassphrase("");
      setConfirm("");
      reset();
      return;
    }
    toast.error(`Backup failed: ${result.error}`);
    reset();
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Configuration Backup</CardTitle>
        <CardDescription>
          Download an encrypted backup of your current modem configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-y-8" onSubmit={handleSubmit}>
          <FieldSet>
            <FieldLegend variant="label">
              Select the items you want to include in the backup.
            </FieldLegend>
            <FieldGroup className="gap-3">
              {BACKUP_SECTIONS.map((s) => {
                const isDisabled = disabled.has(s.key);
                const checked = selection[s.key] && !isDisabled;
                return (
                  <Field key={s.key} orientation="horizontal">
                    <Checkbox
                      id={`backup-section-${s.key}`}
                      name={`backup-section-${s.key}`}
                      checked={checked}
                      disabled={isDisabled}
                      onCheckedChange={(v) =>
                        setSelection((prev) => ({
                          ...prev,
                          [s.key]: v === true,
                        }))
                      }
                    />
                    <FieldLabel
                      htmlFor={`backup-section-${s.key}`}
                      className="font-normal"
                    >
                      {s.label}
                      {isDisabled && s.overlapGroup === "profile" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Included via Custom SIM Profiles
                        </span>
                      )}
                      {isDisabled && s.key === "profiles" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Uncheck overlapping items to include profiles
                        </span>
                      )}
                    </FieldLabel>
                  </Field>
                );
              })}
            </FieldGroup>
          </FieldSet>

          <div className="grid gap-y-4">
            <Field>
              <FieldLabel htmlFor="backup-passphrase">Passphrase</FieldLabel>
              <div className="relative max-w-sm">
                <Input
                  id="backup-passphrase"
                  type={showPassphrase ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 10 characters"
                  className="pr-10"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassphrase((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                >
                  {showPassphrase ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="backup-passphrase-confirm">
                Confirm passphrase
              </FieldLabel>
              <div className="relative max-w-sm">
                <Input
                  id="backup-passphrase-confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  aria-describedby={confirm.length > 0 ? "backup-confirm-hint" : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide passphrase" : "Show passphrase"}
                >
                  {showConfirm ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </Button>
              </div>
              {confirm.length > 0 && (
                <p
                  id="backup-confirm-hint"
                  className={cn(
                    "text-xs transition-colors duration-200",
                    passphrase === confirm ? "text-success" : "text-destructive"
                  )}
                >
                  {passphrase === confirm ? "Passphrases match" : "Passphrases don't match"}
                </p>
              )}
            </Field>
            <p className="text-xs text-muted-foreground max-w-sm">
              Store this passphrase somewhere safe. If you lose it, this backup
              cannot be recovered — there is no reset option.
            </p>
          </div>

          <div>
            <Button type="submit" disabled={!canDownload}>
              {busy && <Loader2Icon className="size-4 animate-spin" />}
              {buttonLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ConfigBackupCard;
