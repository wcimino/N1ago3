import { getAuthorColor, isCustomerMessage, getMessageSender } from "../../../lib/messageUtils";
import { useDateFormatters } from "../../hooks";
import {
  MessageBubbleProps,
  FormPayload,
  FormResponsePayload,
  FilePayload,
  ActionsPayload,
  ImagePayload,
  safeParsePayload,
  isValidFormPayload,
  isValidFormResponsePayload,
  isValidFilePayload,
  isValidActionsPayload,
  ActionsContent,
  FormContent,
  FormResponseContent,
  FileContent,
} from "./messageBubble";

export function MessageBubble({ message, onImageClick, currentHandlerName }: MessageBubbleProps) {
  const { formatDateTimeShort } = useDateFormatters();
  const isCustomer = isCustomerMessage(message.author_type);
  const sender = getMessageSender(message.author_type, message.author_name, message.author_id);
  const hasImage = message.content_type === "image" && message.content_payload && "mediaUrl" in message.content_payload;
  
  const timestamp = message.zendesk_timestamp || message.received_at;
  
  const displayName = message.author_name || message.author_type;

  const renderContent = () => {
    if (hasImage) {
      return (
        <div
          onClick={() => onImageClick?.(message.content_payload as ImagePayload)}
          className="cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          <img 
            src={(message.content_payload as ImagePayload).mediaUrl} 
            alt={(message.content_payload as ImagePayload).altText || "Imagem enviada"}
            className="max-w-full rounded-lg max-h-64 object-contain"
            loading="lazy"
          />
        </div>
      );
    }

    if (message.content_type === "form" && message.content_payload) {
      const parsed = safeParsePayload<FormPayload>(message.content_payload);
      if (isValidFormPayload(parsed)) {
        return <FormContent payload={parsed} />;
      }
    }

    if (message.content_type === "formResponse" && message.content_payload) {
      const parsed = safeParsePayload<FormResponsePayload>(message.content_payload);
      if (isValidFormResponsePayload(parsed)) {
        return <FormResponseContent payload={parsed} />;
      }
    }

    if (message.content_type === "file" && message.content_payload) {
      const parsed = safeParsePayload<FilePayload>(message.content_payload);
      if (isValidFilePayload(parsed)) {
        return <FileContent payload={parsed} fileName={message.content_text || undefined} />;
      }
    }

    const parsed = safeParsePayload<ActionsPayload>(message.content_payload);
    const hasActions = isValidActionsPayload(parsed);

    return (
      <div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {message.content_text || `[${message.content_type}]`}
        </p>
        {hasActions && <ActionsContent actions={parsed.actions} />}
      </div>
    );
  };

  const getBubbleStyle = () => {
    if (isCustomer) {
      return "bg-white rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl";
    }
    
    const baseRounded = "rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl";
    
    switch (sender) {
      case "n1ago":
        return `bg-purple-100 ${baseRounded}`;
      case "zendeskBot":
        return `bg-amber-100 ${baseRounded}`;
      case "human":
      default:
        return `bg-green-100 ${baseRounded}`;
    }
  };
  
  const getSenderTextColor = () => {
    switch (sender) {
      case "n1ago":
        return { main: "text-purple-700", muted: "text-purple-400" };
      case "zendeskBot":
        return { main: "text-amber-700", muted: "text-amber-400" };
      case "human":
      default:
        return { main: "text-green-700", muted: "text-green-400" };
    }
  };
  
  const textColors = getSenderTextColor();

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[75%] ${getBubbleStyle()} shadow-sm px-4 py-2`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${getAuthorColor(message.author_type, message.author_name, message.author_id)}`} />
          <span className={`text-xs font-medium ${isCustomer ? "text-gray-700" : textColors.main}`}>
            {displayName}
          </span>
        </div>

        {renderContent()}

        <p className={`text-[10px] mt-1 text-right ${isCustomer ? "text-gray-400" : textColors.muted}`}>
          {timestamp ? formatDateTimeShort(timestamp) : "-"}
        </p>
      </div>
    </div>
  );
}
