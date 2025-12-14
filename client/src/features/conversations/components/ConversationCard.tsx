import { MessageCircle, UserCheck, UserX, ArrowRight, Clock, Calendar } from "lucide-react";
import { HandlerBadge, getHandlerInfo } from "../../../shared/components/badges/HandlerBadge";
import { Button } from "../../../shared/components/ui/Button";
import { FavoriteButton } from "../../favorites/components/FavoriteButton";
import type { ConversationListItem } from "../../../types";

const emotionConfig: Record<number, { label: string; color: string; bgColor: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "text-green-700", bgColor: "bg-green-100", emoji: "😊" },
  2: { label: "Positivo", color: "text-emerald-700", bgColor: "bg-emerald-100", emoji: "🙂" },
  3: { label: "Neutro", color: "text-gray-600", bgColor: "bg-gray-100", emoji: "😐" },
  4: { label: "Irritado", color: "text-orange-700", bgColor: "bg-orange-100", emoji: "😤" },
  5: { label: "Muito irritado", color: "text-red-700", bgColor: "bg-red-100", emoji: "😠" },
};

interface ConversationCardProps {
  conversation: ConversationListItem;
  onViewConversation: (userId: string, conversationId: number) => void;
  formatDateTime: (date: string) => string;
  favoriteIds: number[];
  onToggleFavorite: (conversationId: number) => void;
  isTogglingFavorite?: boolean;
}

function getUserDisplayName(conversation: ConversationListItem): string {
  const profile = conversation.user_info?.profile;
  if (profile) {
    const givenName = (profile as any)?.givenName || "";
    const surname = (profile as any)?.surname || "";
    if (givenName || surname) {
      return `${givenName} ${surname}`.trim();
    }
  }
  return conversation.user_id || "Usuário desconhecido";
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

function getObjectiveProblemsDisplay(problems: { id: number; name: string; matchScore?: number }[] | null): { name: string; matchScore?: number }[] {
  if (!problems || problems.length === 0) return [];
  return problems.slice(0, 3);
}

export function ConversationCard({
  conversation,
  onViewConversation,
  formatDateTime,
  favoriteIds,
  onToggleFavorite,
  isTogglingFavorite = false,
}: ConversationCardProps) {
  const handlerInfo = getHandlerInfo(conversation.current_handler_name);
  const isFavorite = favoriteIds.includes(conversation.id);
  const emotion = conversation.customer_emotion_level ? emotionConfig[conversation.customer_emotion_level] : null;
  
  const productText = formatProductText(conversation.product_standard, conversation.subproduct_standard);
  const subjectText = formatSubjectText(conversation.subject, conversation.intent);
  const objectiveProblems = getObjectiveProblemsDisplay(conversation.objective_problems ?? []);
  const customerRequestType = conversation.customer_request_type;

  return (
    <div className="p-4 hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-b-0">
      <div className="flex gap-3">
        {handlerInfo && (
          <div className="flex-shrink-0 pt-0.5">
            <HandlerBadge handlerName={conversation.current_handler_name} size="lg" />
          </div>
        )}
        
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {getUserDisplayName(conversation)}
                </h3>
                {emotion && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${emotion.bgColor} ${emotion.color}`}>
                    <span>{emotion.emoji}</span>
                    <span className="hidden sm:inline">{emotion.label}</span>
                  </span>
                )}
                {conversation.user_info?.authenticated ? (
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
              <FavoriteButton
                conversationId={conversation.id}
                isFavorite={isFavorite}
                onToggle={() => onToggleFavorite(conversation.id)}
                isLoading={isTogglingFavorite}
              />
              <Button
                onClick={() => onViewConversation(conversation.user_id, conversation.id)}
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Ver
              </Button>
            </div>
          </div>

          {(productText || subjectText || customerRequestType || objectiveProblems.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {productText && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 max-w-full truncate"
                  title={productText}
                >
                  {productText}
                </span>
              )}
              {customerRequestType && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 max-w-full truncate"
                  title={`Tipo: ${customerRequestType}`}
                >
                  {customerRequestType}
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
              {objectiveProblems.map((problem, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 max-w-full truncate"
                  title={`${problem.name}${problem.matchScore ? ` (${Math.round(problem.matchScore)}% match)` : ''}`}
                >
                  {problem.name}
                  {problem.matchScore && (
                    <span className="text-amber-500 text-[10px]">{Math.round(problem.matchScore)}%</span>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(conversation.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDateTime(conversation.updated_at)}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500">
              <MessageCircle className="w-3 h-3" />
              <span>{conversation.message_count} msg</span>
            </span>
            {conversation.status === "active" && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-medium text-green-600">1 ativa</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
