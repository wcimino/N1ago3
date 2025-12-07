import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge, type BadgeVariant } from "../shared/components/ui";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { variant: BadgeVariant; icon: React.ReactNode }> = {
  success: { variant: "success", icon: <CheckCircle className="w-3 h-3" /> },
  error: { variant: "error", icon: <XCircle className="w-3 h-3" /> },
  pending: { variant: "warning", icon: <Clock className="w-3 h-3" /> },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { variant: "default" as BadgeVariant, icon: null };

  return (
    <Badge variant={config.variant} icon={config.icon} size="md" rounded="full">
      {status}
    </Badge>
  );
}
