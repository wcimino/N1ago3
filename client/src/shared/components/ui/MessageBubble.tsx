import { motion } from "framer-motion";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { getAuthorColor, isCustomerMessage } from "../../../lib/messageUtils";
import { useDateFormatters } from "../../hooks";
import type { Message, ImagePayload } from "../../../types";

interface FormField {
  name?: string;
  label: string;
  type: string;
  text?: string;
}

interface FormPayload {
  fields: FormField[];
}

interface FormResponsePayload {
  textFallback?: string;
  fields?: FormField[];
}

interface MessageBubbleProps {
  message: Message;
  onImageClick?: (payload: ImagePayload) => void;
  currentHandlerName?: string | null;
}

function safeParsePayload<T>(payload: unknown): T | null {
  if (!payload) return null;
  
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }
  
  return payload as T;
}

function isValidFormPayload(payload: unknown): payload is FormPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.fields) && p.fields.length > 0;
}

function isValidFormResponsePayload(payload: unknown): payload is FormResponsePayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.fields) || typeof p.textFallback === "string";
}

function FormContent({ payload }: { payload: FormPayload }) {
  return (
    <div className="text-sm text-gray-800">
      <div className="flex items-center gap-1.5 text-blue-600 font-medium mb-1">
        <ClipboardList className="w-4 h-4" />
        <span>Formulário</span>
      </div>
      <div className="space-y-1 text-gray-600 italic">
        {payload.fields.map((field, idx) => (
          <p key={idx}>{field.label}</p>
        ))}
      </div>
    </div>
  );
}

function FormResponseContent({ payload }: { payload: FormResponsePayload }) {
  if (payload.textFallback) {
    return (
      <div className="text-sm text-gray-800">
        <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Resposta do formulário</span>
        </div>
        <p className="whitespace-pre-wrap break-words">{payload.textFallback}</p>
      </div>
    );
  }

  if (!payload.fields?.length) {
    return (
      <div className="text-sm text-gray-800">
        <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Resposta do formulário</span>
        </div>
        <p className="text-gray-500 italic">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-800">
      <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
        <CheckCircle2 className="w-4 h-4" />
        <span>Resposta do formulário</span>
      </div>
      <div className="space-y-1">
        {payload.fields.map((field, idx) => (
          <div key={idx}>
            <span className="text-gray-500 text-xs">{field.label}:</span>
            <p className="whitespace-pre-wrap break-words">{field.text || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageBubble({ message, onImageClick, currentHandlerName }: MessageBubbleProps) {
  const { formatDateTimeShort } = useDateFormatters();
  const isCustomer = isCustomerMessage(message.author_type);
  const isN1agoByName = message.author_name?.toLowerCase().includes("n1ago");
  const isN1agoByHandler = currentHandlerName?.toLowerCase().includes("n1ago") && 
    (message.author_type === "business" || message.author_type === "agent");
  const isN1ago = isN1agoByName || isN1agoByHandler;
  const hasImage = message.content_type === "image" && message.content_payload && "mediaUrl" in message.content_payload;
  
  const timestamp = message.zendesk_timestamp || message.received_at;
  
  const displayName = isN1ago && !isN1agoByName ? "N1ago" : (message.author_name || message.author_type);

  const renderContent = () => {
    if (hasImage) {
      return (
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

    return (
      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
        {message.content_text || `[${message.content_type}]`}
      </p>
    );
  };

  const getBubbleStyle = () => {
    if (isCustomer) {
      return "bg-white rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl";
    }
    if (isN1ago) {
      return "bg-purple-100 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl";
    }
    return "bg-green-100 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl";
  };

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[75%] ${getBubbleStyle()} shadow-sm px-4 py-2`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${isN1ago ? "bg-purple-500" : getAuthorColor(message.author_type)}`} />
          <span className={`text-xs font-medium ${isN1ago ? "text-purple-700" : "text-gray-700"}`}>
            {displayName}
          </span>
        </div>

        {renderContent()}

        <p className={`text-[10px] mt-1 text-right ${isN1ago ? "text-purple-400" : "text-gray-400"}`}>
          {timestamp ? formatDateTimeShort(timestamp) : "-"}
        </p>
      </div>
    </div>
  );
}
