import { useState } from "react";
import { MessageCircle, Plus, Power, PowerOff } from "lucide-react";
import { Button } from "../../../../shared/components/ui";
import { RuleCard } from "./RuleCard";
import { DEFAULT_ONGOING_CONV_FORM } from "./config";
import type { RoutingRule, OngoingConvFormData } from "./types";

interface OngoingConversationSectionProps {
  rules: RoutingRule[];
  isLoading: boolean;
  isFormOpen: boolean;
  onToggleForm: () => void;
  onCreate: (data: { ruleType: string; target: string; allocateCount: number; matchText: string }, onSuccess: () => void) => void;
  onDeactivate: (id: number) => void;
  onDelete: (id: number) => void;
  isCreating: boolean;
  isDeactivating: boolean;
}

export function OngoingConversationSection({
  rules,
  isLoading,
  isFormOpen,
  onToggleForm,
  onCreate,
  onDeactivate,
  onDelete,
  isCreating,
  isDeactivating,
}: OngoingConversationSectionProps) {
  const [formData, setFormData] = useState<OngoingConvFormData>(DEFAULT_ONGOING_CONV_FORM);

  const activeRules = rules.filter(r => r.isActive);
  const inactiveRules = rules.filter(r => !r.isActive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(
      {
        ruleType: "transfer_ongoing",
        target: formData.target,
        allocateCount: formData.allocateCount,
        matchText: formData.matchText,
      },
      () => setFormData(DEFAULT_ONGOING_CONV_FORM)
    );
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h4 className="text-base font-semibold text-gray-900">Conversas em Andamento</h4>
          </div>
          <Button
            onClick={onToggleForm}
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
        {isFormOpen && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h5 className="text-sm font-semibold text-gray-900 mb-3">
              Transferir conversas quando mensagem contiver texto
            </h5>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-gray-700 text-sm">Quando a mensagem for exatamente</span>
                <input
                  type="text"
                  placeholder="Ex: quero falar com atendente"
                  value={formData.matchText}
                  onChange={(e) => setFormData({ ...formData, matchText: e.target.value })}
                  className="flex-1 min-w-[200px] px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-gray-700 text-sm">Transferir as próximas</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.allocateCount}
                  onChange={(e) => setFormData({ ...formData, allocateCount: parseInt(e.target.value) || 1 })}
                  className="w-20 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <span className="text-gray-700 text-sm">conversas para</span>
                <select
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
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
                  disabled={isCreating || !formData.matchText.trim()}
                  isLoading={isCreating}
                  size="sm"
                >
                  Criar Regra
                </Button>
                <Button
                  type="button"
                  onClick={onToggleForm}
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
            {activeRules.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Power className="w-4 h-4 text-green-600" />
                  Ativas
                </h5>
                <div className="space-y-2">
                  {activeRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onDeactivate={() => onDeactivate(rule.id)}
                      onDelete={() => onDelete(rule.id)}
                      isDeactivating={isDeactivating}
                    />
                  ))}
                </div>
              </div>
            )}

            {inactiveRules.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <PowerOff className="w-4 h-4" />
                  Inativas
                </h5>
                <div className="space-y-2 opacity-60">
                  {inactiveRules.slice(0, 3).map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onDelete={() => onDelete(rule.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {rules.length === 0 && !isFormOpen && (
              <div className="text-center py-6 text-gray-400 text-sm">
                Nenhuma regra para conversas em andamento
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
