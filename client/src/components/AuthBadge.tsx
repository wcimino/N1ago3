import { UserCheck, UserX } from "lucide-react";

interface AuthBadgeProps {
  authenticated: boolean;
}

export function AuthBadge({ authenticated }: AuthBadgeProps) {
  return authenticated ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <UserCheck className="w-3 h-3" />
      Autenticado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <UserX className="w-3 h-3" />
      Anônimo
    </span>
  );
}
