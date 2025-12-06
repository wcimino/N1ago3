import { motion } from "framer-motion";
import { getAuthorColor, isCustomerMessage } from "../../lib/messageUtils";
import { useDateFormatters } from "../../hooks/useDateFormatters";
import type { Message, ImagePayload } from "../../types";

interface MessageBubbleProps {
  message: Message;
  onImageClick?: (payload: ImagePayload) => void;
}

export function MessageBubble({ message, onImageClick }: MessageBubbleProps) {
  const { formatDateTimeShort } = useDateFormatters();
  const isCustomer = isCustomerMessage(message.author_type);
  const hasImage = message.content_type === "image" && message.content_payload && "mediaUrl" in message.content_payload;
  
  const timestamp = message.zendesk_timestamp || message.received_at;

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] ${
          isCustomer
            ? "bg-white rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl"
            : "bg-green-100 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl"
        } shadow-sm px-4 py-2`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${getAuthorColor(message.author_type)}`} />
          <span className="text-xs font-medium text-gray-700">
            {message.author_name || message.author_type}
          </span>
        </div>

        {hasImage ? (
          <motion.div
            layoutId={`image-${message.id}`}
            onClick={() => onImageClick?.(message.content_payload as ImagePayload)}
            className="cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <img 
              src={(message.content_payload as ImagePayload).mediaUrl} 
              alt={(message.content_payload as ImagePayload).altText || "Imagem enviada"}
              className="max-w-full rounded-lg max-h-64 object-contain"
              loading="lazy"
            />
          </motion.div>
        ) : (
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {message.content_text || `[${message.content_type}]`}
          </p>
        )}

        <p className="text-[10px] text-gray-400 mt-1 text-right">
          {timestamp ? formatDateTimeShort(timestamp) : "-"}
        </p>
      </div>
    </div>
  );
}
