import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Route, ArrowRight, Bot, Brain, UserCircle, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";

interface RoutingRule {
  id: number;
  ruleType: string;
  target: string;
  allocateCount: number | null;
  allocatedCount: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
}

const TARGET_INFO: Record<string, { label: string; icon: typeof Bot; bgClass: string; iconClass: string }> = {
  n1ago: { label: "N1ago", icon: Brain, bgClass: "bg-purple-100", iconClass: "text-purple-600" },
  human: { label: "Humano", icon: UserCircle, bgClass: "bg-amber-100", iconClass: "text-amber-600" },
  bot: { label: "Bot Zendesk", icon: Bot, bgClass: "bg-emerald-100", iconClass: "text-emerald-600" },
};

export function RoutingRulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    target: "n1ago",
    allocateCount: 10,
  });

  const { data: rules, isLoading } = useQuery<RoutingRule[]>({
    queryKey: ["routing-rules"],
    queryFn: () => fetchApi<RoutingRule[]>("/api/routing/rules"),
  });

  const createRule = useMutation({
    mutationFn: async (data: { ruleType: string; target: string; allocateCount: number }) => {
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
      setShowForm(false);
      setFormData({ target: "n1ago", allocateCount: 10 });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate({
      ruleType: "allocate_next_n",
      target: formData.target,
      allocateCount: formData.allocateCount,
    });
  };

  const activeRules = rules?.filter(r => r.isActive) || [];
  const inactiveRules = rules?.filter(r => !r.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Route className="w-6 h-6 text-purple-600" />
            Regras de Roteamento
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure como as novas conversas devem ser distribuídas
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Alocar próximas conversas
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-gray-700">Alocar as próximas</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={formData.allocateCount}
                onChange={(e) => setFormData({ ...formData, allocateCount: parseInt(e.target.value) || 1 })}
                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <span className="text-gray-700">conversas novas para</span>
              <select
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="n1ago">N1ago</option>
                <option value="human">Humano</option>
                <option value="bot">Bot Zendesk</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createRule.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {createRule.isPending ? "Criando..." : "Criar Regra"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando regras...</div>
      ) : (
        <div className="space-y-6">
          {activeRules.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Power className="w-5 h-5 text-green-600" />
                Regras Ativas
              </h2>
              <div className="space-y-3">
                {activeRules.map((rule) => (
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

          {inactiveRules.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <PowerOff className="w-5 h-5" />
                Regras Inativas
              </h2>
              <div className="space-y-3 opacity-60">
                {inactiveRules.slice(0, 5).map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onDelete={() => deleteRule.mutate(rule.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {rules?.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Route className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma regra de roteamento configurada</p>
              <p className="text-sm text-gray-400 mt-1">
                Crie uma regra para começar a alocar conversas automaticamente
              </p>
            </div>
          )}
        </div>
      )}
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
  const targetInfo = TARGET_INFO[rule.target] || TARGET_INFO.n1ago;
  const Icon = targetInfo.icon;
  const progress = rule.allocateCount ? (rule.allocatedCount / rule.allocateCount) * 100 : 0;
  const remaining = rule.allocateCount ? rule.allocateCount - rule.allocatedCount : 0;

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${rule.isActive ? "" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${targetInfo.bgClass}`}>
            <Icon className={`w-5 h-5 ${targetInfo.iconClass}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <span className="font-medium">Alocar próximas {rule.allocateCount} conversas</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className={`font-semibold ${targetInfo.iconClass}`}>{targetInfo.label}</span>
            </div>
            {rule.isActive && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{rule.allocatedCount} alocadas</span>
                  <span>•</span>
                  <span>{remaining} restantes</span>
                </div>
                <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rule.isActive && onDeactivate && (
            <button
              onClick={onDeactivate}
              disabled={isDeactivating}
              className="p-2 text-gray-400 hover:text-amber-600 transition-colors"
              title="Desativar regra"
            >
              <PowerOff className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Excluir regra"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
