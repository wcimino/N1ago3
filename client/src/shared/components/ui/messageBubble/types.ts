import type { Message, ImagePayload } from "../../../../types";

export interface FilePayload {
  type: "file";
  mediaUrl: string;
  mediaType?: string;
  mediaSize?: number;
  altText?: string;
  text?: string;
  attachmentId?: string;
}

export interface FormField {
  name?: string;
  label: string;
  type: string;
  text?: string;
}

export interface FormPayload {
  fields: FormField[];
}

export interface FormResponsePayload {
  textFallback?: string;
  fields?: FormField[];
}

export interface MessageAction {
  text: string;
  uri?: string;
  type: "link" | "reply" | "postback" | "webview" | string;
  payload?: string;
}

export interface ActionsPayload {
  actions: MessageAction[];
}

export interface MessageBubbleProps {
  message: Message;
  onImageClick?: (payload: ImagePayload) => void;
  currentHandlerName?: string | null;
}

export type { Message, ImagePayload };
