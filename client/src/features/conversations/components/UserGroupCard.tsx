import { Link } from "wouter";
import { Users, MessageCircle, Activity, User, UserCheck, ArrowLeftRight } from "lucide-react";
import { HandlerBadge, getHandlerInfo } from "../../../shared/components/badges/HandlerBadge";
import { getUserDisplayName, getActiveConversationsCount, getUserFromGroup } from "../../../lib/userUtils";
import type { User as UserType, UserGroup } from "../../../types";

const emotionConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "bg-green-100 text-green-700", emoji: "😊" },
  2: { label: "Positivo", color: "bg-emerald-100 text-emerald-700", emoji: "🙂" },
  3: { label: "Neutro", color: "bg-gray-100 text-gray-600", emoji: "😐" },
  4: { label: "Irritado", color: "bg-orange-100 text-orange-700", emoji: "😤" },
  5: { label: "Muito irritado", color: "bg-red-100 text-red-700", emoji: "😠" },
};

interface UserGroupCardProps {
  group: UserGroup;
  onViewUser: (user: UserType) => void;
  onViewConversations: (userId: string) => void;
  formatDateTime: (date: string) => string;
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
  onViewUser,
  onViewConversations,
  formatDateTime,
}: UserGroupCardProps) {
  const activeCount = getActiveConversationsCount(group.conversations);
  const latestHandler = getLatestHandler(group.conversations);
  const handlerInfo = getHandlerInfo(latestHandler);

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {handlerInfo && <HandlerBadge handlerName={latestHandler} />}
            <ArrowLeftRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-gray-900 truncate">{getUserDisplayName(group)}</h3>
                {group.last_customer_emotion_level && emotionConfig[group.last_customer_emotion_level] && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${emotionConfig[group.last_customer_emotion_level].color}`}>
                    {emotionConfig[group.last_customer_emotion_level].emoji} {emotionConfig[group.last_customer_emotion_level].label}
                  </span>
                )}
                {group.user_info?.authenticated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <UserCheck className="w-3 h-3" />
                    Autenticado
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
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {group.user_info && (
              <button
                onClick={() => {
                  const user = getUserFromGroup(group);
                  if (user) onViewUser(user);
                }}
                title="Ver detalhes do usuário"
                className="p-2 border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <User className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onViewConversations(group.user_id)}
              title="Ver conversas"
              className="p-2 border border-gray-200 text-gray-600 hover:text-green-600 hover:border-green-300 hover:bg-green-50 rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <Link
              href={`/events?user=${encodeURIComponent(group.user_id)}`}
              title="Ver eventos"
              className="p-2 border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <Activity className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Início:</span>
            <span className="text-xs text-gray-500">{formatDateTime(group.first_activity)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-500">Último:</span>
            {group.last_product_standard && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {group.last_product_standard}
              </span>
            )}
            {group.last_intent && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {group.last_intent}
              </span>
            )}
            <span className="text-xs text-gray-500">{formatDateTime(group.last_activity)}</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {activeCount} ativa{activeCount > 1 ? "s" : ""}
              </span>
            )}
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
      </div>
    </div>
  );
}
