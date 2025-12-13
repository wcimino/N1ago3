import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, User, Loader2, Mail, Phone, Building2, Clock, Shield, Globe } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import { useDateFormatters } from "../../../shared/hooks";

interface ZendeskUserDetail {
  id: number;
  zendeskId: number;
  url: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  sharedPhoneNumber: boolean | null;
  alias: string | null;
  role: string | null;
  roleType: number | null;
  customRoleId: number | null;
  verified: boolean | null;
  active: boolean | null;
  suspended: boolean | null;
  moderator: boolean | null;
  restrictedAgent: boolean | null;
  organizationId: number | null;
  defaultGroupId: number | null;
  timeZone: string | null;
  ianaTimeZone: string | null;
  locale: string | null;
  localeId: number | null;
  details: string | null;
  notes: string | null;
  signature: string | null;
  tags: string[] | null;
  externalId: string | null;
  ticketRestriction: string | null;
  onlyPrivateComments: boolean | null;
  chatOnly: boolean | null;
  shared: boolean | null;
  sharedAgent: boolean | null;
  twoFactorAuthEnabled: boolean | null;
  zendeskCreatedAt: string | null;
  zendeskUpdatedAt: string | null;
  lastLoginAt: string | null;
  userFields: Record<string, unknown> | null;
  photo: Record<string, unknown> | null;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ZendeskUserDetailPageProps {
  params: { id: string };
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value ?? "-"}</span>
    </div>
  );
}

function BooleanBadge({ value, trueLabel, falseLabel }: { value: boolean | null; trueLabel: string; falseLabel: string }) {
  if (value === null) return <span className="text-gray-400">-</span>;
  return value ? (
    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{trueLabel}</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{falseLabel}</span>
  );
}

export function ZendeskUserDetailPage({ params }: ZendeskUserDetailPageProps) {
  const [, navigate] = useLocation();
  const { formatShortDateTime } = useDateFormatters();

  const { data: user, isLoading, error } = useQuery<ZendeskUserDetail>({
    queryKey: ["zendesk-user", params.id],
    queryFn: () => fetchApi<ZendeskUserDetail>(`/api/external-data/zendesk-users/${params.id}`),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-red-500">Erro ao carregar usuário</p>
        <button onClick={() => navigate("/settings/external-data/zendesk-users")} className="mt-4 text-primary hover:underline">
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-4">
        <button
          onClick={() => navigate("/settings/external-data/zendesk-users")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.suspended ? (
            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Suspenso</span>
          ) : user.active ? (
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Ativo</span>
          ) : (
            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">Inativo</span>
          )}
          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{user.role}</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoCard title="Identificação" icon={<User className="w-4 h-4" />}>
          <Field label="ID N1ago" value={user.id} />
          <Field label="Zendesk ID" value={user.zendeskId} />
          <Field label="External ID" value={user.externalId} />
          <Field label="Alias" value={user.alias} />
        </InfoCard>

        <InfoCard title="Contato" icon={<Mail className="w-4 h-4" />}>
          <Field label="Email" value={user.email} />
          <Field label="Telefone" value={user.phone} />
          <Field label="Telefone compartilhado" value={<BooleanBadge value={user.sharedPhoneNumber} trueLabel="Sim" falseLabel="Não" />} />
        </InfoCard>

        <InfoCard title="Organização" icon={<Building2 className="w-4 h-4" />}>
          <Field label="Organization ID" value={user.organizationId} />
          <Field label="Default Group ID" value={user.defaultGroupId} />
        </InfoCard>

        <InfoCard title="Permissões" icon={<Shield className="w-4 h-4" />}>
          <Field label="Role" value={user.role} />
          <Field label="Role Type" value={user.roleType} />
          <Field label="Custom Role ID" value={user.customRoleId} />
          <Field label="Verificado" value={<BooleanBadge value={user.verified} trueLabel="Sim" falseLabel="Não" />} />
          <Field label="Moderador" value={<BooleanBadge value={user.moderator} trueLabel="Sim" falseLabel="Não" />} />
          <Field label="Agente restrito" value={<BooleanBadge value={user.restrictedAgent} trueLabel="Sim" falseLabel="Não" />} />
          <Field label="2FA" value={<BooleanBadge value={user.twoFactorAuthEnabled} trueLabel="Ativo" falseLabel="Inativo" />} />
          <Field label="Ticket Restriction" value={user.ticketRestriction} />
          <Field label="Só comentários privados" value={<BooleanBadge value={user.onlyPrivateComments} trueLabel="Sim" falseLabel="Não" />} />
        </InfoCard>

        <InfoCard title="Localização" icon={<Globe className="w-4 h-4" />}>
          <Field label="Timezone" value={user.timeZone} />
          <Field label="IANA Timezone" value={user.ianaTimeZone} />
          <Field label="Locale" value={user.locale} />
          <Field label="Locale ID" value={user.localeId} />
        </InfoCard>

        <InfoCard title="Datas" icon={<Clock className="w-4 h-4" />}>
          <Field label="Criado no Zendesk" value={user.zendeskCreatedAt ? formatShortDateTime(user.zendeskCreatedAt) : null} />
          <Field label="Atualizado no Zendesk" value={user.zendeskUpdatedAt ? formatShortDateTime(user.zendeskUpdatedAt) : null} />
          <Field label="Último login" value={user.lastLoginAt ? formatShortDateTime(user.lastLoginAt) : null} />
          <Field label="Sincronizado em" value={formatShortDateTime(user.syncedAt)} />
        </InfoCard>

        {user.details && (
          <div className="md:col-span-2 lg:col-span-3 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Detalhes</h3>
            <p className="text-sm text-gray-600">{user.details}</p>
          </div>
        )}

        {user.notes && (
          <div className="md:col-span-2 lg:col-span-3 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas</h3>
            <p className="text-sm text-gray-600">{user.notes}</p>
          </div>
        )}

        {user.signature && (
          <div className="md:col-span-2 lg:col-span-3 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Assinatura</h3>
            <p className="text-sm text-gray-600">{user.signature}</p>
          </div>
        )}

        {user.tags && user.tags.length > 0 && (
          <div className="md:col-span-2 lg:col-span-3 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1">
              {user.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {user.userFields && Object.keys(user.userFields).length > 0 && (
          <div className="md:col-span-2 lg:col-span-3 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Campos Personalizados</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(user.userFields).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-gray-500">{key}: </span>
                  <span className="text-gray-900">{value !== null ? String(value) : "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
