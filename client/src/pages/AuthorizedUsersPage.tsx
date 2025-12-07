import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest, fetchApi } from "../lib/queryClient";
import { useDateFormatters } from "../hooks/useDateFormatters";
import { LoadingState, EmptyState, LoadingSpinner } from "../components";
import type { AuthorizedUser } from "../types";

export function AuthorizedUsersPage() {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { formatShortDateTime } = useDateFormatters();

  const { data: authorizedUsers, isLoading } = useQuery<AuthorizedUser[]>({
    queryKey: ["authorized-users"],
    queryFn: () => fetchApi<AuthorizedUser[]>("/api/authorized-users"),
  });

  const addMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const res = await apiRequest("POST", "/api/authorized-users", { email, name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
      setNewEmail("");
      setNewName("");
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao adicionar usuário");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/authorized-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newEmail.toLowerCase().endsWith("@ifood.com.br")) {
      setError("Email deve ser do domínio @ifood.com.br");
      return;
    }

    addMutation.mutate({ email: newEmail, name: newName });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Adicionar Usuário Autorizado
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="usuario@ifood.com.br"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do usuário"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={addMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {addMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Usuários Autorizados</h2>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : !authorizedUsers || authorizedUsers.length === 0 ? (
          <EmptyState
            title="Nenhum usuário autorizado cadastrado."
            description="Adicione usuários usando o formulário acima."
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adicionado em</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adicionado por</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último acesso</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {authorizedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{user.name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.createdAt ? formatShortDateTime(user.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{user.createdBy || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.lastAccess ? formatShortDateTime(user.lastAccess) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeMutation.mutate(user.id)}
                          disabled={removeMutation.isPending}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-200">
              {authorizedUsers.map((user) => (
                <div key={user.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{user.email}</p>
                      {user.name && <p className="text-sm text-gray-500 mt-0.5">{user.name}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                        {user.createdAt && <span>Adicionado: {formatShortDateTime(user.createdAt)}</span>}
                        {user.createdBy && <span>Por: {user.createdBy}</span>}
                        {user.lastAccess && <span>Último acesso: {formatShortDateTime(user.lastAccess)}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate(user.id)}
                      disabled={removeMutation.isPending}
                      className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
