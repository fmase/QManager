"use client";

import {
  CheckCircle2Icon,
  Loader2Icon,
  MinusCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SectionProgress } from "@/types/config-backup";
import { BACKUP_SECTIONS } from "@/lib/config-backup/sections";

const LABELS: Record<string, string> = Object.fromEntries(
  BACKUP_SECTIONS.map((s) => [s.key, s.label]),
);

// Shared base so every status badge renders at an identical width
const BADGE_BASE = "min-w-[7.5rem] justify-center";

function StatusBadge({
  status,
}: {
  status: SectionProgress["status"];
}) {
  if (status === "success") {
    return (
      <Badge
        variant="outline"
        className={`${BADGE_BASE} bg-success/15 text-success hover:bg-success/20 border-success/30`}
      >
        <CheckCircle2Icon className="size-3" />
        Restored
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge
        variant="outline"
        className={`${BADGE_BASE} bg-info/15 text-info hover:bg-info/20 border-info/30`}
      >
        <Loader2Icon className="size-3 animate-spin" />
        Running
      </Badge>
    );
  }
  if (status.startsWith("retrying:")) {
    const n = status.split(":")[1];
    return (
      <Badge
        variant="outline"
        className={`${BADGE_BASE} bg-warning/15 text-warning hover:bg-warning/20 border-warning/30`}
      >
        <Loader2Icon className="size-3 animate-spin" />
        Retrying ({n}/3)
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge
        variant="outline"
        className={`${BADGE_BASE} bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30`}
      >
        <XCircleIcon className="size-3" />
        Failed
      </Badge>
    );
  }
  if (status.startsWith("skipped")) {
    return (
      <Badge
        variant="outline"
        className={`${BADGE_BASE} bg-muted/50 text-muted-foreground border-muted-foreground/30`}
      >
        <MinusCircleIcon className="size-3" />
        Skipped
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={`${BADGE_BASE} bg-muted/50 text-muted-foreground border-muted-foreground/30`}
    >
      <MinusCircleIcon className="size-3" />
      Pending
    </Badge>
  );
}

export interface RestoreProgressListProps {
  sections: SectionProgress[];
}

export function RestoreProgressList({ sections }: RestoreProgressListProps) {
  return (
    <ul className="grid gap-2 text-sm w-full">
      {sections.map((s) => (
        <li
          key={s.key}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-foreground/90">{LABELS[s.key] ?? s.key}</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={s.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
