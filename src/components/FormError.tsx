import { CircleAlert, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function FormError({ children, icon: Icon = CircleAlert }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <Alert variant="destructive">
      <Icon aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
