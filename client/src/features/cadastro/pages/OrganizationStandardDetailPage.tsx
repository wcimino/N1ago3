import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, FileText, Clock, Users } from "lucide-react";
import {
  LoadingState,
  EmptyState,
  DetailPageHeader,
  InfoField,
  HistoryList,
  RelatedEntityList
} from "../../../shared/components";
import { useDateFormatters } from "../../../shared/hooks";
import { fetchApi } from "../../../lib/queryClient";
import { formatCnpjRoot } from "../../../lib/formatters";

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

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  cnpj: "CNPJ Completo",
};

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
        <DetailPageHeader
          title="Detalhes da Organização"
          subtitle={formatCnpjRoot(organization.cnpjRoot)}
          onBack={() => navigate("/cadastro/organizacoes")}
        />

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <InfoField
                icon={<Building2 className="w-5 h-5" />}
                label="Nome"
                value={organization.name}
              />
              <InfoField
                icon={<FileText className="w-5 h-5" />}
                label="CNPJ Raiz"
                value={formatCnpjRoot(organization.cnpjRoot)}
              />
              <InfoField
                icon={<FileText className="w-5 h-5" />}
                label="CNPJ Completo"
                value={organization.cnpj}
              />
            </div>

            <div className="space-y-4">
              <InfoField
                icon={<Clock className="w-5 h-5" />}
                label="Último contato"
                value={formatDateTime(organization.lastSeenAt)}
              />
              <InfoField
                icon={<Clock className="w-5 h-5" />}
                label="Primeiro contato"
                value={formatDateTime(organization.firstSeenAt)}
              />
              <InfoField
                icon={<span className="text-xs font-bold">SRC</span>}
                label="Fonte"
                value={organization.source}
              />
            </div>
          </div>
        </div>
      </div>

      <RelatedEntityList
        title="Usuários Associados"
        icon={<Users className="w-5 h-5 text-gray-500" />}
        items={users}
        isLoading={usersLoading}
        emptyMessage="Nenhum usuário associado"
        keyExtractor={(user) => user.id}
        onItemClick={(user) => navigate(`/cadastro/users/${encodeURIComponent(user.email)}`)}
        renderItem={(user) => (
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{user.name || user.email}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <span className="text-xs text-gray-400">{user.source}</span>
          </div>
        )}
      />

      <HistoryList
        history={history}
        isLoading={historyLoading}
        fieldLabels={FIELD_LABELS}
        formatDateTime={formatShortDateTime}
      />
    </div>
  );
}
