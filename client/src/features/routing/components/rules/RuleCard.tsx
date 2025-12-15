import { ArrowRight, Clock, PowerOff, Trash2 } from "lucide-react";
import { useDateFormatters } from "../../../../shared/hooks";
import { AUTH_FILTER_INFO, TARGET_INFO } from "./config";
import type { RoutingRule } from "./types";

interface RuleCardProps {
  rule: RoutingRule;
  onDeactivate?: () => void;
  onDelete: () => void;
  isDeactivating?: boolean;
}

export function RuleCard({ rule, onDeactivate, onDelete, isDeactivating }: RuleCardProps) {
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
