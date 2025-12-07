import { Users } from "lucide-react";
import { AuthBadge } from "./AuthBadge";
import { useDateFormatters } from "../../shared/hooks/useDateFormatters";
import type { User } from "../types";

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-start bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {displayName || `Usuário #${user.id}`}
              </h2>
              <p className="text-sm text-gray-500">{user.profile?.email || user.sunshine_id.slice(0, 20) + "..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AuthBadge authenticated={user.authenticated} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              &times;
            </button>
          </div>
        </div>
        
        <div className="p-5 overflow-auto max-h-[calc(90vh-100px)]">
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
        </div>
      </div>
    </div>
  );
}
