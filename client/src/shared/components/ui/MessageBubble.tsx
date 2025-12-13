import { motion } from "framer-motion";
import { ClipboardList, CheckCircle2, ExternalLink, FileText, Download } from "lucide-react";
import { getAuthorColor, isCustomerMessage, getMessageSender } from "../../../lib/messageUtils";
import { useDateFormatters } from "../../hooks";
import type { Message, ImagePayload } from "../../../types";

interface FilePayload {
  type: "file";
  mediaUrl: string;
  mediaType?: string;
  mediaSize?: number;
  altText?: string;
  text?: string;
  attachmentId?: string;
}

function isValidFilePayload(payload: unknown): payload is FilePayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return p.type === "file" && typeof p.mediaUrl === "string";
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

interface MessageAction {
  text: string;
  uri?: string;
  type: "link" | "reply" | "postback" | "webview" | string;
  payload?: string;
}

interface ActionsPayload {
  actions: MessageAction[];
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

function isValidActionsPayload(payload: unknown): payload is ActionsPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.actions) && p.actions.length > 0;
}

function isValidActionUri(uri: string | undefined): boolean {
  if (!uri) return false;
  const allowedSchemes = ["https:", "http:", "mailto:", "tel:", "whatsapp:"];
  try {
    const url = new URL(uri);
    return allowedSchemes.includes(url.protocol);
  } catch {
    return uri.startsWith("/");
  }
}

function ActionsContent({ actions }: { actions: MessageAction[] }) {
  const replyActions = actions.filter(a => a.type === "reply" || a.type === "postback");
  const linkActions = actions.filter(a => a.type !== "reply" && a.type !== "postback");

  return (
    <div className="flex flex-col gap-2 mt-2">
      {replyActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {replyActions.map((action, idx) => (
            <span
              key={`reply-${idx}`}
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-300"
            >
              {action.text}
            </span>
          ))}
        </div>
      )}
      {linkActions.map((action, idx) => {
        const safeUri = isValidActionUri(action.uri) ? action.uri : undefined;
        if (!safeUri) return null;
        
        return (
          <a
            key={`link-${idx}`}
            href={safeUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-full hover:bg-primary-900 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>{action.text}</span>
          </a>
        );
      })}
    </div>
  );
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

function FileContent({ payload, fileName }: { payload: FilePayload; fileName?: string }) {
  const displayName = fileName || payload.altText || payload.text || "Arquivo";
  const fileSize = formatFileSize(payload.mediaSize);
  
  return (
    <a 
      href={payload.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
    >
      <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
        <FileText className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
        {fileSize && (
          <p className="text-xs text-gray-500">{fileSize}</p>
        )}
      </div>
      <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
    </a>
  );
}

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
