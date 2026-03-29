import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, MinusCircleIcon } from "lucide-react";

export function ServiceStatusBadge({
  status,
  installed = true,
}: {
  status: string;
  installed?: boolean;
}) {
  if (status === "running") {
    return (
      <Badge
        variant="outline"
        className="border-success/30 bg-success/15 text-success hover:bg-success/20"
      >
        <CheckCircle2Icon className="size-3" />
        Active
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
    >
      <MinusCircleIcon className="size-3" />
      {installed ? "Inactive" : "Not Installed"}
    </Badge>
  );
}
