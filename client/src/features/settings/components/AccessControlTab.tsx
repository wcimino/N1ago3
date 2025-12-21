import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, UserPlus } from "lucide-react";
import { LoadingState, EmptyState, Button } from "../../../shared/components";
import { useDateFormatters } from "../../../shared/hooks";
import { useAuthorizedUsers } from "../hooks/useAuthorizedUsers";

export function AccessControlTab() {
  const [showForm, setShowForm] = useState(false);
  const { formatShortDateTime } = useDateFormatters();
  
  const {
    authorizedUsers,
    isLoading,
    newEmail,
    setNewEmail,
    newName,
    setNewName,
    error,
    isAdding,
    isRemoving,
    handleSubmit,
    handleRemove,
  } = useAuthorizedUsers();

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
        >
          <span className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            + Usuário
          </span>
          {showForm ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showForm && (
          <div className="px-4 pb-4 border-t border-gray-200 pt-4">
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

              <Button
                type="submit"
                disabled={isAdding}
                isLoading={isAdding}
                leftIcon={!isAdding ? <Plus className="w-4 h-4" /> : undefined}
              >
                Adicionar
              </Button>
            </form>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">Usuários Autorizados</h3>

        {isLoading ? (
          <LoadingState />
        ) : !authorizedUsers || authorizedUsers.length === 0 ? (
          <EmptyState
            title="Nenhum usuário autorizado cadastrado."
            description="Adicione usuários usando o formulário acima."
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto border rounded-lg">
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
                <tbody className="divide-y divide-gray-200 bg-white">
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
                          onClick={() => handleRemove(user.id)}
                          disabled={isRemoving}
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

            <div className="md:hidden divide-y divide-gray-200 border rounded-lg overflow-hidden">
              {authorizedUsers.map((user) => (
                <div key={user.id} className="p-4 bg-white hover:bg-gray-50">
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
                      onClick={() => handleRemove(user.id)}
                      disabled={isRemoving}
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
