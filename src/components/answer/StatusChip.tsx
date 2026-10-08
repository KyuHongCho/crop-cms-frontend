import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BASE = "h-auto! min-h-5 whitespace-normal! rounded-xl! py-1 text-sm! text-left";

export default function StatusChip({
  tone,
  icon: Icon,
  role,
  children,
}: {
  tone: "neutral" | "notice";
  icon: LucideIcon;
  role?: "status";
  children: React.ReactNode;
}) {
  // The icon sits in a span so Badge's own `[&>svg]:size-3` does not shrink it below 16px.
  const icon = (
    <span className="inline-flex shrink-0">
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
  return tone === "notice" ? (
    <Badge variant="notice" role={role} className={BASE}>
      {icon}
      {children}
    </Badge>
  ) : (
    <Badge variant="secondary" role={role} className={BASE}>
      {icon}
      {children}
    </Badge>
  );
}
