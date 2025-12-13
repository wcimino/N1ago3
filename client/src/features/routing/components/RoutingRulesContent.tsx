import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Route, ArrowRight, Bot, Brain, UserCircle, Plus, Trash2, Power, PowerOff, MessageCircle, Sparkles, Clock } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import { useDateFormatters } from "../../../shared/hooks";
import { Button } from "../../../shared/components/ui";

interface RoutingRule {
  id: number;
  ruleType: string;
  target: string;
  allocateCount: number | null;
  allocatedCount: number;
  isActive: boolean;
  authFilter: string;
  matchText: string | null;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
}

const AUTH_FILTER_INFO: Record<string, { label: string; shortLabel: string }> = {
  all: { label: "Todos os clientes", shortLabel: "Todos" },
  authenticated: { label: "Apenas autenticados", shortLabel: "Autenticados" },
  unauthenticated: { label: "Apenas não autenticados", shortLabel: "Não autenticados" },
};

const TARGET_INFO: Record<string, { label: string; icon: typeof Bot; bgClass: string; iconClass: string }> = {
  n1ago: { label: "N1ago", icon: Brain, bgClass: "bg-purple-100", iconClass: "text-purple-600" },
  human: { label: "Humano", icon: UserCircle, bgClass: "bg-amber-100", iconClass: "text-amber-600" },
  bot: { label: "Bot Zendesk", icon: Bot, bgClass: "bg-emerald-100", iconClass: "text-emerald-600" },
};

type FormType = "new_conversation" | "ongoing_conversation" | null;

export function RoutingRulesContent() {
  const queryClient = useQueryClient();
  const [activeForm, setActiveForm] = useState<FormType>(null);
  
  const [newConvForm, setNewConvForm] = useState({
    target: "n1ago",
    allocateCount: 10,
    authFilter: "all",
  });

  const [ongoingConvForm, setOngoingConvForm] = useState({
    target: "n1ago",
    allocateCount: 10,
    matchText: "",
  });

  const { data: rules, isLoading } = useQuery<RoutingRule[]>({
    queryKey: ["routing-rules"],
    queryFn: () => fetchApi<RoutingRule[]>("/api/routing/rules"),
  });

  const createRule = useMutation({
    mutationFn: async (data: { ruleType: string; target: string; allocateCount: number; authFilter?: string; matchText?: string }) => {
      const response = await fetch("/api/routing/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
      setActiveForm(null);
      setNewConvForm({ target: "n1ago", allocateCount: 10, authFilter: "all" });
      setOngoingConvForm({ target: "n1ago", allocateCount: 10, matchText: "" });
    },
  });

  const deactivateRule = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/routing/rules/${id}/deactivate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to deactivate rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/routing/rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
    },
  });

  const handleSubmitNewConv = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate({
      ruleType: "allocate_next_n",
      target: newConvForm.target,
      allocateCount: newConvForm.allocateCount,
      authFilter: newConvForm.authFilter,
    });
  };

  const handleSubmitOngoingConv = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate({
      ruleType: "transfer_ongoing",
      target: ongoingConvForm.target,
      allocateCount: ongoingConvForm.allocateCount,
      matchText: ongoingConvForm.matchText,
    });
  };

  const newConvRules = rules?.filter(r => r.ruleType === "allocate_next_n") || [];
  const ongoingConvRules = rules?.filter(r => r.ruleType === "transfer_ongoing") || [];
  
  const activeNewConvRules = newConvRules.filter(r => r.isActive);
  const inactiveNewConvRules = newConvRules.filter(r => !r.isActive);
  
  const activeOngoingRules = ongoingConvRules.filter(r => r.isActive);
  const inactiveOngoingRules = ongoingConvRules.filter(r => !r.isActive);

  return (
    <div className="p-4 space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Route className="w-5 h-5 text-purple-600" />
          Regras de Roteamento
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure como as conversas devem ser distribuídas
        </p>
      </div>

      {/* Seção: Novas Conversas */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h4 className="text-base font-semibold text-gray-900">Novas Conversas</h4>
            </div>
            <Button
              onClick={() => setActiveForm(activeForm === "new_conversation" ? null : "new_conversation")}
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Nova Regra
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Regras para alocar conversas que acabaram de iniciar
          </p>
        </div>

        <div className="p-4 space-y-4">
          {activeForm === "new_conversation" && (
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">
                Alocar próximas novas conversas
              </h5>
              <form onSubmit={handleSubmitNewConv} className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-gray-700 text-sm">Alocar as próximas</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newConvForm.allocateCount}
                    onChange={(e) => setNewConvForm({ ...newConvForm, allocateCount: parseInt(e.target.value) || 1 })}
                    className="w-20 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                  <span className="text-gray-700 text-sm">conversas novas para</span>
                  <select
                    value={newConvForm.target}
                    onChange={(e) => setNewConvForm({ ...newConvForm, target: e.target.value })}
                    className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  >
                    <option value="n1ago">N1ago</option>
                    <option value="human">Humano</option>
                    <option value="bot">Bot Zendesk</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-gray-700 text-sm">Tipo de cliente:</span>
                  <select
                    value={newConvForm.authFilter}
                    onChange={(e) => setNewConvForm({ ...newConvForm, authFilter: e.target.value })}
                    className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  >
                    <option value="all">Todos os clientes</option>
                    <option value="authenticated">Apenas autenticados</option>
                    <option value="unauthenticated">Apenas não autenticados</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createRule.isPending}
                    isLoading={createRule.isPending}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Criar Regra
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setActiveForm(null)}
                    variant="ghost"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : (
            <>
              {activeNewConvRules.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Power className="w-4 h-4 text-green-600" />
                    Ativas
                  </h5>
                  <div className="space-y-2">
                    {activeNewConvRules.map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        onDeactivate={() => deactivateRule.mutate(rule.id)}
                        onDelete={() => deleteRule.mutate(rule.id)}
                        isDeactivating={deactivateRule.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactiveNewConvRules.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <PowerOff className="w-4 h-4" />
                    Inativas
                  </h5>
                  <div className="space-y-2 opacity-60">
                    {inactiveNewConvRules.slice(0, 3).map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        onDelete={() => deleteRule.mutate(rule.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {newConvRules.length === 0 && activeForm !== "new_conversation" && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  Nenhuma regra para novas conversas
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Seção: Conversas em Andamento */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <h4 className="text-base font-semibold text-gray-900">Conversas em Andamento</h4>
            </div>
            <Button
              onClick={() => setActiveForm(activeForm === "ongoing_conversation" ? null : "ongoing_conversation")}
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Nova Regra
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Regras para transferir conversas baseado no conteúdo da mensagem
          </p>
        </div>

        <div className="p-4 space-y-4">
          {activeForm === "ongoing_conversation" && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">
                Transferir conversas quando mensagem contiver texto
              </h5>
              <form onSubmit={handleSubmitOngoingConv} className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-gray-700 text-sm">Quando a mensagem for exatamente</span>
                  <input
                    type="text"
                    placeholder="Ex: quero falar com atendente"
                    value={ongoingConvForm.matchText}
                    onChange={(e) => setOngoingConvForm({ ...ongoingConvForm, matchText: e.target.value })}
                    className="flex-1 min-w-[200px] px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-gray-700 text-sm">Transferir as próximas</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={ongoingConvForm.allocateCount}
                    onChange={(e) => setOngoingConvForm({ ...ongoingConvForm, allocateCount: parseInt(e.target.value) || 1 })}
                    className="w-20 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <span className="text-gray-700 text-sm">conversas para</span>
                  <select
                    value={ongoingConvForm.target}
                    onChange={(e) => setOngoingConvForm({ ...ongoingConvForm, target: e.target.value })}
                    className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="n1ago">N1ago</option>
                    <option value="human">Humano</option>
                    <option value="bot">Bot Zendesk</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createRule.isPending || !ongoingConvForm.matchText.trim()}
                    isLoading={createRule.isPending}
                    size="sm"
                  >
                    Criar Regra
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setActiveForm(null)}
                    variant="ghost"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : (
            <>
              {activeOngoingRules.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Power className="w-4 h-4 text-green-600" />
                    Ativas
                  </h5>
                  <div className="space-y-2">
                    {activeOngoingRules.map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        onDeactivate={() => deactivateRule.mutate(rule.id)}
                        onDelete={() => deleteRule.mutate(rule.id)}
                        isDeactivating={deactivateRule.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactiveOngoingRules.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <PowerOff className="w-4 h-4" />
                    Inativas
                  </h5>
                  <div className="space-y-2 opacity-60">
                    {inactiveOngoingRules.slice(0, 3).map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        onDelete={() => deleteRule.mutate(rule.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {ongoingConvRules.length === 0 && activeForm !== "ongoing_conversation" && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  Nenhuma regra para conversas em andamento
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface RuleCardProps {
  rule: RoutingRule;
  onDeactivate?: () => void;
  onDelete: () => void;
  isDeactivating?: boolean;
}

function RuleCard({ rule, onDeactivate, onDelete, isDeactivating }: RuleCardProps) {
  const { formatDateTimeShort } = useDateFormatters();
  const targetInfo = TARGET_INFO[rule.target] || TARGET_INFO.n1ago;
  const authInfo = AUTH_FILTER_INFO[rule.authFilter] || AUTH_FILTER_INFO.all;
  const Icon = targetInfo.icon;
  const progress = rule.allocateCount ? (rule.allocatedCount / rule.allocateCount) * 100 : 0;
  const remaining = rule.allocateCount ? rule.allocateCount - rule.allocatedCount : 0;
  const isOngoing = rule.ruleType === "transfer_ongoing";

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-3 ${rule.isActive ? "" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${targetInfo.bgClass}`}>
            <Icon className={`w-4 h-4 ${targetInfo.iconClass}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-900 text-sm">
              {isOngoing ? (
                <>
                  <span className="font-medium">Quando mensagem = "{rule.matchText}"</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span>Transferir {rule.allocateCount} para</span>
                </>
              ) : (
                <>
                  <span className="font-medium">Alocar próximas {rule.allocateCount} conversas</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </>
              )}
              <span className={`font-semibold ${targetInfo.iconClass}`}>{targetInfo.label}</span>
              {!isOngoing && rule.authFilter !== "all" && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                  {authInfo.shortLabel}
                </span>
              )}
            </div>
            <div className="mt-1">
              {rule.isActive && (
                <>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{rule.allocatedCount} alocadas</span>
                    <span>•</span>
                    <span>{remaining} restantes</span>
                    {!isOngoing && rule.authFilter !== "all" && (
                      <>
                        <span>•</span>
                        <span>{authInfo.label}</span>
                      </>
                    )}
                  </div>
                  <div className="w-40 h-1 bg-gray-200 rounded-full mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${isOngoing ? 'bg-blue-500' : 'bg-purple-500'}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </>
              )}
              <div className={`flex items-center gap-1 text-xs ${rule.isActive ? 'text-gray-400 mt-1' : 'text-gray-400'}`}>
                <Clock className="w-3 h-3" />
                <span>Criada em {formatDateTimeShort(rule.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {rule.isActive && onDeactivate && (
            <button
              onClick={onDeactivate}
              disabled={isDeactivating}
              className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors"
              title="Desativar regra"
            >
              <PowerOff className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
            title="Excluir regra"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
