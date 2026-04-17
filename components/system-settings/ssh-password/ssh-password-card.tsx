"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SaveButton } from "@/components/ui/save-button";
import { TbInfoCircleFilled } from "react-icons/tb";

import { useSshPassword } from "@/hooks/use-ssh-password";
import { useTranslation } from "react-i18next";

function meetsPolicy(password: string, enforceStrong: boolean): boolean {
  if (password.length < 5) return false;
  if (!enforceStrong) return true;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

const SshPasswordCard = () => {
  const { t } = useTranslation("system-settings");
  const { changePassword, isPending, error, clearError } = useSshPassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [enforceStrong, setEnforceStrong] = useState(true);

  const policyHint = enforceStrong
    ? t("ssh_password.strong_policy_hint")
    : t("ssh_password.weak_policy_hint");

  const policyOk = useMemo(
    () => meetsPolicy(next, enforceStrong),
    [next, enforceStrong]
  );
  const confirmMatches = next.length > 0 && next === confirm;
  const canSubmit =
    !isPending &&
    current.length > 0 &&
    next.length > 0 &&
    confirm.length > 0 &&
    policyOk &&
    confirmMatches;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const ok = await changePassword(current, next, enforceStrong);
    if (ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(t("ssh_password.toast_success"));
    }
  }, [canSubmit, changePassword, current, next, enforceStrong, t]);

  const onAnyInputChange = useCallback(() => {
    if (error) clearError();
  }, [error, clearError]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("ssh_password.card_title")}</CardTitle>
        <CardDescription>
          {t("ssh_password.card_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="ssh-current">{t("ssh_password.current_label")}</Label>
            <Input
              id="ssh-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                onAnyInputChange();
              }}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ssh-new">{t("ssh_password.new_label")}</Label>
            <Input
              id="ssh-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                onAnyInputChange();
              }}
              disabled={isPending}
              aria-describedby="ssh-new-hint"
            />
            {next.length > 0 && !policyOk && (
              <p id="ssh-new-hint" className="text-xs text-destructive">
                {policyHint}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ssh-confirm">{t("ssh_password.confirm_label")}</Label>
            <Input
              id="ssh-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                onAnyInputChange();
              }}
              disabled={isPending}
              aria-describedby="ssh-confirm-hint"
            />
            {confirm.length > 0 && !confirmMatches && (
              <p id="ssh-confirm-hint" className="text-xs text-destructive">
                {t("ssh_password.error_mismatch")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex"
                    aria-label={t("ssh_password.enforce_strong_info_aria")}
                  >
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("ssh_password.strong_policy_hint")}</p>
                </TooltipContent>
              </Tooltip>
              <span className="font-semibold text-muted-foreground text-sm">
                {t("ssh_password.enforce_strong_label")}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ssh-strong"
                checked={enforceStrong}
                disabled={isPending}
                onCheckedChange={(checked) => {
                  setEnforceStrong(checked);
                  onAnyInputChange();
                }}
              />
              <Label htmlFor="ssh-strong">
                {enforceStrong ? t("state.on", { ns: "common" }) : t("state.off", { ns: "common" })}
              </Label>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <SaveButton
              isSaving={isPending}
              saved={false}
              label="Change Password"
              disabled={!canSubmit}
              onClick={handleSubmit}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SshPasswordCard;
