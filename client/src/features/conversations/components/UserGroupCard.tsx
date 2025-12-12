import { MessageCircle, UserCheck, UserX, ArrowRight, Clock, Calendar } from "lucide-react";
import { HandlerBadge, getHandlerInfo } from "../../../shared/components/badges/HandlerBadge";
import { getUserDisplayName, getActiveConversationsCount } from "../../../lib/userUtils";
import { FavoriteButton } from "../../favorites/components/FavoriteButton";
import type { UserGroup } from "../../../types";

const emotionConfig: Record<number, { label: string; color: string; bgColor: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "text-green-700", bgColor: "bg-green-100", emoji: "😊" },
  2: { label: "Positivo", color: "text-emerald-700", bgColor: "bg-emerald-100", emoji: "🙂" },
  3: { label: "Neutro", color: "text-gray-600", bgColor: "bg-gray-100", emoji: "😐" },
  4: { label: "Irritado", color: "text-orange-700", bgColor: "bg-orange-100", emoji: "😤" },
  5: { label: "Muito irritado", color: "text-red-700", bgColor: "bg-red-100", emoji: "😠" },
};

interface UserGroupCardProps {
  group: UserGroup;
  onViewConversations: (userId: string) => void;
  formatDateTime: (date: string) => string;
  favoriteIds: number[];
  onToggleFavorite: (conversationId: number) => void;
  isTogglingFavorite?: boolean;
}

function getLatestHandler(conversations: Array<{ current_handler_name?: string | null }>) {
  for (let i = conversations.length - 1; i >= 0; i--) {
    if (conversations[i].current_handler_name) {
      return conversations[i].current_handler_name;
    }
  }
  return null;
}

function formatProductText(product: string | null, subproduct: string | null): string | null {
  if (!product) return null;
  if (product.toLowerCase().includes("nenhum")) return null;
  if (subproduct && subproduct.toLowerCase().includes("nenhum")) {
    return product;
  }
  return subproduct ? `${product} › ${subproduct}` : product;
}

function formatSubjectText(subject: string | null, intent: string | null): string | null {
  if (!subject && !intent) return null;
  if (subject) {
    return intent ? `${subject} › ${intent}` : subject;
  }
  return intent;
}

export function UserGroupCard({
  group,
  onViewConversations,
  formatDateTime,
  favoriteIds,
  onToggleFavorite,
  isTogglingFavorite = false,
}: UserGroupCardProps) {
  const activeCount = getActiveConversationsCount(group.conversations);
  const latestHandler = getLatestHandler(group.conversations);
  const handlerInfo = getHandlerInfo(latestHandler);
  const primaryConversation = group.conversations[group.conversations.length - 1];
  const isPrimaryFavorite = primaryConversation ? favoriteIds.includes(primaryConversation.id) : false;
  const totalMessages = group.conversations.reduce((sum, conv) => sum + (conv.message_count || 0), 0);
  
  const productText = formatProductText(group.last_product_standard, group.last_subproduct_standard);
  const subjectText = formatSubjectText(group.last_subject, group.last_intent);
  const emotion = group.last_customer_emotion_level ? emotionConfig[group.last_customer_emotion_level] : null;

  return (
    <div className="p-4 hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-b-0">
      <div className="flex gap-3">
        {handlerInfo && (
          <div className="flex-shrink-0 pt-0.5">
            <HandlerBadge handlerName={latestHandler} size="lg" />
          </div>
        )}
        
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Linha 1: nome, irritado, anonimo */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {getUserDisplayName(group)}
                </h3>
                {activeCount > 0 && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-medium text-green-600">{activeCount} ativa{activeCount > 1 ? "s" : ""}</span>
                  </span>
                )}
                {emotion && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${emotion.bgColor} ${emotion.color}`}>
                    <span>{emotion.emoji}</span>
                    <span className="hidden sm:inline">{emotion.label}</span>
                  </span>
                )}
                {group.user_info?.authenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <UserCheck className="w-3 h-3" />
                    <span className="hidden sm:inline">Autenticado</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                    <UserX className="w-3 h-3" />
                    <span className="hidden sm:inline">Anônimo</span>
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              {primaryConversation && (
                <FavoriteButton
                  conversationId={primaryConversation.id}
                  isFavorite={isPrimaryFavorite}
                  onToggle={() => onToggleFavorite(primaryConversation.id)}
                  isLoading={isTogglingFavorite}
                />
              )}
              <button
                onClick={() => onViewConversations(group.user_id)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                Ver
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Linha 2: cartao > cartao ... entrega ... */}
          {(productText || subjectText) && (
            <div className="flex flex-wrap gap-1.5">
              {productText && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 max-w-full truncate"
                  title={productText}
                >
                  {productText}
                </span>
              )}
              {subjectText && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 max-w-full truncate"
                  title={subjectText}
                >
                  {subjectText}
                </span>
              )}
            </div>
          )}

          {/* Linha 3: data inicio, data ultima, conversas, mensagens */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(group.first_activity)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDateTime(group.last_activity)}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500">
              <MessageCircle className="w-3 h-3" />
              <span>{group.conversation_count}</span>
              {totalMessages > 0 && (
                <span className="text-gray-400">• {totalMessages} msg</span>
              )}
            </span>
          </div>

          {group.conversations.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {group.conversations.slice(0, 3).map((conv, idx) => (
                <span
                  key={conv.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    conv.status === "active" 
                      ? "bg-green-50 text-green-700 border border-green-200" 
                      : "bg-gray-50 text-gray-500 border border-gray-200"
                  }`}
                >
                  #{idx + 1} • {conv.message_count} msg
                </span>
              ))}
              {group.conversations.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-500 border border-gray-200">
                  +{group.conversations.length - 3} mais
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
