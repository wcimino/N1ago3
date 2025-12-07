import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users, Mail, FileText, Clock, Building2 } from "lucide-react";
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

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  cpf: "CPF",
  phone: "Telefone",
  locale: "Idioma",
  externalId: "ID Externo",
  sourceUserId: "ID na Fonte",
};

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
        <DetailPageHeader
          title="Detalhes do Usuário"
          subtitle={user.email}
          onBack={() => navigate("/cadastro")}
        />

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <InfoField
                icon={<Users className="w-5 h-5" />}
                label="Nome"
                value={user.name}
              />
              <InfoField
                icon={<Mail className="w-5 h-5" />}
                label="Email"
                value={user.email}
              />
              <InfoField
                icon={<FileText className="w-5 h-5" />}
                label="CPF"
                value={user.cpf}
              />
            </div>

            <div className="space-y-4">
              <InfoField
                icon={<Clock className="w-5 h-5" />}
                label="Último contato"
                value={formatDateTime(user.lastSeenAt)}
              />
              <InfoField
                icon={<span className="text-xs font-bold">SRC</span>}
                label="Fonte"
                value={user.source}
              />
            </div>
          </div>
        </div>
      </div>

      <RelatedEntityList
        title="Organizações Associadas"
        icon={<Building2 className="w-5 h-5 text-gray-500" />}
        items={organizations}
        isLoading={orgsLoading}
        emptyMessage="Nenhuma organização associada"
        keyExtractor={(org) => org.id}
        onItemClick={(org) => navigate(`/cadastro/organizations/${encodeURIComponent(org.cnpjRoot)}`)}
        renderItem={(org) => (
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{org.name || "Sem nome"}</p>
              <p className="text-sm text-gray-500">CNPJ Raiz: {formatCnpjRoot(org.cnpjRoot)}</p>
            </div>
            <span className="text-xs text-gray-400">{org.source}</span>
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
