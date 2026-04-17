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

const STRONG_POLICY_HINT =
  "New password must be at least 5 characters and include uppercase, lowercase, and a number.";
const WEAK_POLICY_HINT = "New password must be at least 5 characters.";

function meetsPolicy(password: string, enforceStrong: boolean): boolean {
  if (password.length < 5) return false;
  if (!enforceStrong) return true;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

const SshPasswordCard = () => {
  const { changePassword, isPending, error, clearError } = useSshPassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [enforceStrong, setEnforceStrong] = useState(true);

  const policyHint = enforceStrong ? STRONG_POLICY_HINT : WEAK_POLICY_HINT;

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
      toast.success("SSH password updated");
    }
  }, [canSubmit, changePassword, current, next, enforceStrong]);

  const onAnyInputChange = useCallback(() => {
    if (error) clearError();
  }, [error, clearError]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>SSH Password</CardTitle>
        <CardDescription>
          Change the root password used for SSH and console access. This is
          separate from the QManager web login and does not affect your current
          browser session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="ssh-current">Current SSH password</Label>
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
            <Label htmlFor="ssh-new">New SSH password</Label>
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
            <Label htmlFor="ssh-confirm">Confirm new SSH password</Label>
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
                Passwords do not match.
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
                    aria-label="Strong password policy info"
                  >
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{STRONG_POLICY_HINT}</p>
                </TooltipContent>
              </Tooltip>
              <span className="font-semibold text-muted-foreground text-sm">
                Enforce strong password
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
                {enforceStrong ? "On" : "Off"}
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
