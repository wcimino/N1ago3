import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, Users, Mail, FileText, Clock, History, Building2 } from "lucide-react";
import { LoadingState, EmptyState } from "../../../shared/components";
import { useDateFormatters } from "../../../shared/hooks";
import { fetchApi } from "../../../lib/queryClient";

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

interface UserHistory {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  source: string | null;
}

interface OrganizationStandard {
  id: number;
  cnpj: string | null;
  cnpjRoot: string;
  source: string;
  name: string | null;
}

interface UserStandardDetailPageProps {
  params: { email: string };
}

export function UserStandardDetailPage({ params }: UserStandardDetailPageProps) {
  const [, navigate] = useLocation();
  const email = decodeURIComponent(params.email);
  const { formatDateTime, formatShortDateTime } = useDateFormatters();

  const { data: user, isLoading: userLoading } = useQuery<UserStandard>({
    queryKey: ["user-standard", email],
    queryFn: () => fetchApi<UserStandard>(`/api/users-standard/${encodeURIComponent(email)}`),
  });

  const { data: history, isLoading: historyLoading } = useQuery<UserHistory[]>({
    queryKey: ["user-standard-history", email],
    queryFn: () => fetchApi<UserHistory[]>(`/api/users-standard/${encodeURIComponent(email)}/history`),
  });

  const { data: organizations, isLoading: orgsLoading } = useQuery<OrganizationStandard[]>({
    queryKey: ["user-standard-organizations", email],
    queryFn: () => fetchApi<OrganizationStandard[]>(`/api/users-standard/${encodeURIComponent(email)}/organizations`),
  });

  const formatCnpjRoot = (cnpjRoot: string) => {
    if (cnpjRoot.length === 8) {
      return `${cnpjRoot.slice(0, 2)}.${cnpjRoot.slice(2, 5)}.${cnpjRoot.slice(5, 8)}`;
    }
    return cnpjRoot;
  };

  const fieldLabels: Record<string, string> = {
    name: "Nome",
    cpf: "CPF",
    phone: "Telefone",
    locale: "Idioma",
    externalId: "ID Externo",
    sourceUserId: "ID na Fonte",
  };

  if (userLoading) {
    return <LoadingState />;
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <EmptyState
          icon={<Users className="w-12 h-12 text-gray-300" />}
          title="Usuário não encontrado"
          description={`Não foi possível encontrar o usuário com email ${email}`}
        />
        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/cadastro")}
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
            onClick={() => navigate("/cadastro")}
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detalhes do Usuário</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{user.name || "-"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">CPF</p>
                  <p className="font-medium">{user.cpf || "-"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Último contato</p>
                  <p className="font-medium">{formatDateTime(user.lastSeenAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center text-gray-400 mt-0.5">
                  <span className="text-xs font-bold">SRC</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fonte</p>
                  <p className="font-medium">{user.source}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Organizações Associadas</h3>
        </div>

        {orgsLoading ? (
          <LoadingState />
        ) : !organizations || organizations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>Nenhuma organização associada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/cadastro/organizations/${encodeURIComponent(org.cnpjRoot)}`)}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{org.name || "Sem nome"}</p>
                    <p className="text-sm text-gray-500">CNPJ Raiz: {formatCnpjRoot(org.cnpjRoot)}</p>
                  </div>
                  <span className="text-xs text-gray-400">{org.source}</span>
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
