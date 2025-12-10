import { MessageCircle, UserCheck, UserX, ArrowRight } from "lucide-react";
import { HandlerBadge, getHandlerInfo } from "../../../shared/components/badges/HandlerBadge";
import { getUserDisplayName, getActiveConversationsCount } from "../../../lib/userUtils";
import { FavoriteButton } from "../../favorites/components/FavoriteButton";
import type { UserGroup } from "../../../types";

const emotionConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "bg-green-100 text-green-700", emoji: "😊" },
  2: { label: "Positivo", color: "bg-emerald-100 text-emerald-700", emoji: "🙂" },
  3: { label: "Neutro", color: "bg-gray-100 text-gray-600", emoji: "😐" },
  4: { label: "Irritado", color: "bg-orange-100 text-orange-700", emoji: "😤" },
  5: { label: "Muito irritado", color: "bg-red-100 text-red-700", emoji: "😠" },
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

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex gap-3">
        {handlerInfo && (
          <div className="flex-shrink-0 self-stretch flex items-center">
            <HandlerBadge handlerName={latestHandler} size="lg" />
          </div>
        )}
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-gray-900 truncate">{getUserDisplayName(group)}</h3>
                {group.last_customer_emotion_level && emotionConfig[group.last_customer_emotion_level] && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${emotionConfig[group.last_customer_emotion_level].color}`}>
                    {emotionConfig[group.last_customer_emotion_level].emoji} {emotionConfig[group.last_customer_emotion_level].label}
                  </span>
                )}
                {group.user_info?.authenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <UserCheck className="w-3 h-3" />
                    Autenticado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <UserX className="w-3 h-3" />
                    Não autenticado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <MessageCircle className="w-3 h-3" />
                  {group.conversation_count} {group.conversation_count === 1 ? "conversa" : "conversas"}
                  {(() => {
                    const totalMessages = group.conversations.reduce((sum, conv) => sum + (conv.message_count || 0), 0);
                    return totalMessages > 0 ? <>, {totalMessages} mensagens</> : null;
                  })()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ver
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {group.conversations.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {group.conversations.map((conv, idx) => (
                <span
                  key={conv.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    conv.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  #{idx + 1} - {conv.message_count} msgs - {formatDateTime(conv.created_at)}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {group.last_product_standard && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {group.last_product_standard}{group.last_subproduct_standard ? ` > ${group.last_subproduct_standard}` : ''}
              </span>
            )}
            {(group.last_subject || group.last_intent) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {group.last_subject ? `${group.last_subject}${group.last_intent ? ` > ${group.last_intent}` : ''}` : group.last_intent}
              </span>
            )}
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Início:</span>
              <span className="text-xs text-gray-500">{formatDateTime(group.first_activity)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Última:</span>
              <span className="text-xs text-gray-500">{formatDateTime(group.last_activity)}</span>
            </div>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {activeCount} ativa{activeCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
