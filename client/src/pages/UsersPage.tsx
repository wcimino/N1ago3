import { useLocation } from "wouter";
import { Users, FileText } from "lucide-react";
import { LoadingState, EmptyState, Pagination } from "../components";
import { useDateFormatters } from "../hooks/useDateFormatters";
import { usePaginatedQuery } from "../hooks/usePaginatedQuery";

interface UserStandard {
  id: number;
  email: string;
  source: string;
  sourceUserId: string | null;
  externalId: string | null;
  name: string | null;
  cpf: string | null;
  phone: string | null;
  locale: string | null;
  signedUpAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export function UsersPage() {
  const [, navigate] = useLocation();
  const { formatDateTime } = useDateFormatters();

  const {
    data: users,
    total,
    page,
    totalPages,
    isLoading,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
  } = usePaginatedQuery<UserStandard>({
    queryKey: "users-standard",
    endpoint: "/api/users-standard",
    limit: 20,
    dataKey: "users",
  });

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
        <p className="text-sm text-gray-500 mt-1">Cadastro padronizado de usuários</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12 text-gray-300" />}
          title="Nenhum usuário registrado ainda."
          description="Os usuários serão cadastrados quando mensagens chegarem via webhook."
        />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPF</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr 
                    key={user.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/users/${encodeURIComponent(user.email)}`)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{user.name || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.cpf || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.lastSeenAt ? formatDateTime(user.lastSeenAt) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-200">
            {users.map((user) => (
              <div 
                key={user.id} 
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/users/${encodeURIComponent(user.email)}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{user.name || "-"}</p>
                    <p className="text-sm text-blue-600 mt-0.5 truncate">{user.email}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                      {user.cpf && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {user.cpf}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                      {user.lastSeenAt && <span>Último: {formatDateTime(user.lastSeenAt)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            showingFrom={showingFrom}
            showingTo={showingTo}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
          />
        </>
      )}
    </div>
  );
}
