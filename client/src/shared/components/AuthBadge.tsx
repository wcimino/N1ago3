import { UserCheck, UserX } from "lucide-react";
import { Badge } from "./ui/Badge";

interface AuthBadgeProps {
  authenticated: boolean;
}

export function AuthBadge({ authenticated }: AuthBadgeProps) {
  return authenticated ? (
    <Badge variant="success" icon={<UserCheck className="w-3 h-3" />} size="md" rounded="full">
      Autenticado
    </Badge>
  ) : (
    <Badge variant="default" icon={<UserX className="w-3 h-3" />} size="md" rounded="full">
      Anônimo
    </Badge>
  );
}
