import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, Building2, FileText, Clock, History, Users } from "lucide-react";
import { LoadingState, EmptyState } from "../shared/components";
import { useDateFormatters } from "../shared/hooks";
import { fetchApi } from "../lib/queryClient";

interface OrganizationStandard {
  id: number;
  cnpj: string | null;
  cnpjRoot: string;
  source: string;
  name: string | null;
  metadata: any;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationHistory {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  source: string | null;
}

interface UserStandard {
  id: number;
  email: string;
  source: string;
  name: string | null;
}

interface OrganizationStandardDetailPageProps {
  params: { cnpjRoot: string };
}

export function OrganizationStandardDetailPage({ params }: OrganizationStandardDetailPageProps) {
  const [, navigate] = useLocation();
  const cnpjRoot = decodeURIComponent(params.cnpjRoot);
  const { formatDateTime, formatShortDateTime } = useDateFormatters();

  const { data: organization, isLoading: orgLoading } = useQuery<OrganizationStandard>({
    queryKey: ["organization-standard", cnpjRoot],
    queryFn: () => fetchApi<OrganizationStandard>(`/api/organizations-standard/${encodeURIComponent(cnpjRoot)}`),
  });

  const { data: history, isLoading: historyLoading } = useQuery<OrganizationHistory[]>({
    queryKey: ["organization-standard-history", cnpjRoot],
    queryFn: () => fetchApi<OrganizationHistory[]>(`/api/organizations-standard/${encodeURIComponent(cnpjRoot)}/history`),
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserStandard[]>({
    queryKey: ["organization-standard-users", cnpjRoot],
    queryFn: () => fetchApi<UserStandard[]>(`/api/organizations-standard/${encodeURIComponent(cnpjRoot)}/users`),
  });

  const fieldLabels: Record<string, string> = {
    name: "Nome",
    cnpj: "CNPJ Completo",
  };

  const formatCnpjRoot = (cnpjRoot: string) => {
    if (cnpjRoot.length === 8) {
      return `${cnpjRoot.slice(0, 2)}.${cnpjRoot.slice(2, 5)}.${cnpjRoot.slice(5, 8)}`;
    }
    return cnpjRoot;
  };

  if (orgLoading) {
    return <LoadingState />;
  }

  if (!organization) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <EmptyState
          icon={<Building2 className="w-12 h-12 text-gray-300" />}
          title="Organização não encontrada"
          description={`Não foi possível encontrar a organização com CNPJ raiz ${cnpjRoot}`}
        />
        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/cadastro/organizacoes")}
            className="text-blue-600 hover:text-blue-800"
          >
            Voltar para lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <button
            onClick={() => navigate("/cadastro/organizacoes")}
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detalhes da Organização</h2>
            <p className="text-sm text-gray-500">{formatCnpjRoot(organization.cnpjRoot)}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{organization.name || "-"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">CNPJ Raiz</p>
                  <p className="font-medium">{formatCnpjRoot(organization.cnpjRoot)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">CNPJ Completo</p>
                  <p className="font-medium">{organization.cnpj || "-"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Último contato</p>
                  <p className="font-medium">{formatDateTime(organization.lastSeenAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Primeiro contato</p>
                  <p className="font-medium">{formatDateTime(organization.firstSeenAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center text-gray-400 mt-0.5">
                  <span className="text-xs font-bold">SRC</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fonte</p>
                  <p className="font-medium">{organization.source}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Usuários Associados</h3>
        </div>

        {usersLoading ? (
          <LoadingState />
        ) : !users || users.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>Nenhum usuário associado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/cadastro/users/${encodeURIComponent(user.email)}`)}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{user.name || user.email}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">{user.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <History className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Alterações</h3>
        </div>

        {historyLoading ? (
          <LoadingState />
        ) : !history || history.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>Nenhuma alteração registrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {history.map((item, index) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {fieldLabels[item.fieldName] || item.fieldName}
                    </p>
                    <div className="mt-1 text-sm">
                      <span className="text-red-600 line-through">{item.oldValue || "(vazio)"}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="text-green-600">{item.newValue || "(vazio)"}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{formatShortDateTime(item.changedAt)}</p>
                    {item.source && <p className="text-xs">{item.source}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
