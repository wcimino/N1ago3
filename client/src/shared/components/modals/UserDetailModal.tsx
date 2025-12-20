import { Users } from "lucide-react";
import { AuthBadge } from "../badges";
import { useDateFormatters } from "../../hooks";
import { BaseModal } from "../ui/BaseModal";
import type { User } from "../../../types";

interface UserDetailModalProps {
  user: User;
  onClose: () => void;
}

export function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  const { formatDateTimeWithPrefix } = useDateFormatters();

  const getUserDisplayName = (u: User) => {
    if (u.profile?.givenName || u.profile?.surname) {
      return `${u.profile?.givenName || ""} ${u.profile?.surname || ""}`.trim();
    }
    return null;
  };

  const displayName = getUserDisplayName(user);

  const icon = (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
      <Users className="w-5 h-5 text-blue-600" />
    </div>
  );

  const title = (
    <div className="flex items-center gap-3">
      <div>
        <div className="text-lg font-semibold text-gray-900">
          {displayName || `Usuário #${user.id}`}
        </div>
        <p className="text-sm text-gray-500 font-normal">{user.profile?.email || user.sunshine_id.slice(0, 20) + "..."}</p>
      </div>
      <AuthBadge authenticated={user.authenticated} />
    </div>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={title}
      icon={icon}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Informações Pessoais</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Nome</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{displayName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Email</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{user.profile?.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">External ID</p>
              <p className="text-sm font-medium text-gray-900 mt-1 font-mono">{user.external_id || "-"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Atividade</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Última interação</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatDateTimeWithPrefix(user.last_seen_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Identificadores</h3>
          <div>
            <p className="text-xs text-gray-500 uppercase">Sunshine ID</p>
            <p className="text-sm font-mono bg-gray-50 p-2 rounded mt-1 break-all text-gray-700">{user.sunshine_id}</p>
          </div>
        </div>

        {user.profile && Object.keys(user.profile).length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dados do Perfil (JSON)</h3>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-32 text-gray-700">
              {JSON.stringify(user.profile, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
