import type { UserProfile } from "./users.js";

export interface Conversation {
  id: number;
  external_conversation_id: string;
  external_app_id: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationsResponse {
  total: number;
  offset: number;
  limit: number;
  conversations: Conversation[];
}

export interface ConversationsStatsResponse {
  total: number;
  active: number;
  closed: number;
  totalMessages: number;
}

export interface ImagePayload {
  type: "image";
  mediaUrl: string;
  mediaType?: string;
  altText?: string;
  mediaSize?: number;
}

export interface Message {
  id: number;
  author_type: string;
  author_name: string | null;
  content_type: string;
  content_text: string | null;
  content_payload: ImagePayload | Record<string, any> | null;
  received_at: string;
  zendesk_timestamp: string | null;
}

export interface ConversationMessagesResponse {
  conversation_id: string;
  messages: Message[];
}

export interface UserConversation {
  id: number;
  external_conversation_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  product_standard: string | null;
  intent: string | null;
  current_handler: string | null;
  current_handler_name: string | null;
}

export interface UserGroup {
  user_id: string;
  conversation_count: number;
  last_activity: string;
  first_activity: string;
  conversations: UserConversation[];
  last_product_standard: string | null;
  last_intent: string | null;
  user_info: {
    id: number;
    external_id: string | null;
    authenticated: boolean;
    profile: UserProfile | null;
  } | null;
}

export interface GroupedConversationsResponse {
  total: number;
  offset: number;
  limit: number;
  user_groups: UserGroup[];
}

export interface ConversationSummary {
  text: string;
  generated_at: string | null;
  updated_at: string | null;
  product: string | null;
  intent: string | null;
  confidence: number | null;
  classified_at: string | null;
}

export interface SuggestedResponse {
  text: string;
  created_at: string;
  last_event_id: number | null;
}

export interface ConversationWithMessages {
  conversation: {
    id: number;
    external_conversation_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  messages: Message[];
  summary: ConversationSummary | null;
  suggested_response: SuggestedResponse | null;
}

export interface UserConversationsMessagesResponse {
  user_id: string;
  user_profile: UserProfile | null;
  conversations: ConversationWithMessages[];
}

export interface ExtractedConversation {
  externalConversationId: string;
  externalAppId?: string;
  externalUserId?: string;
  userExternalId?: string;
  metadata?: any;
}
