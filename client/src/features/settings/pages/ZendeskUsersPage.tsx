import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Users, Loader2, Eye } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import { useDateFormatters } from "../../../shared/hooks";

interface ZendeskUser {
  id: number;
  zendeskId: number;
  name: string;
  email: string | null;
  role: string | null;
  active: boolean | null;
  verified: boolean | null;
  suspended: boolean | null;
  organizationId: number | null;
  locale: string | null;
  timeZone: string | null;
  lastLoginAt: string | null;
  zendeskCreatedAt: string | null;
  zendeskUpdatedAt: string | null;
  syncedAt: string;
}

interface ZendeskUsersResponse {
  users: ZendeskUser[];
  total: number;
  limit: number;
  offset: number;
}

export function ZendeskUsersPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);
  const { formatShortDateTime } = useDateFormatters();
  const limit = 50;

  const { data, isLoading } = useQuery<ZendeskUsersResponse>({
    queryKey: ["zendesk-users", search, roleFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      return fetchApi<ZendeskUsersResponse>(`/api/external-data/zendesk-users?${params}`);
    },
  });

  const getRoleBadge = (role: string | null) => {
    const styles: Record<string, string> = {
      admin: "bg-purple-100 text-purple-700",
      agent: "bg-blue-100 text-blue-700",
      "end-user": "bg-gray-100 text-gray-700",
    };
    return styles[role || ""] || "bg-gray-100 text-gray-700";
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-4">
        <button
          onClick={() => navigate("/settings/external-data")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-600" />
          <h1 className="text-lg font-semibold">Usuários Zendesk</h1>
        </div>
        {data && (
          <span className="text-sm text-gray-500">
            {data.total.toLocaleString("pt-BR")} usuários
          </span>
        )}
      </div>

      <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(0);
          }}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os roles</option>
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
          <option value="end-user">End-user</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Último login</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Atualizado em</th>
                  <th className="px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {user.role || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.suspended ? (
                        <span className="text-red-600">Suspenso</span>
                      ) : user.active ? (
                        <span className="text-green-600">Ativo</span>
                      ) : (
                        <span className="text-gray-400">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.lastLoginAt ? formatShortDateTime(user.lastLoginAt) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.zendeskUpdatedAt ? formatShortDateTime(user.zendeskUpdatedAt) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/settings/external-data/zendesk-users/${user.id}`)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Página {page + 1} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
