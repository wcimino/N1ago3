import type { UserProfile } from "./users";

export interface Conversation {
  id: number;
  zendesk_conversation_id: string;
  zendesk_app_id: string | null;
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

export interface Message {
  id: number;
  author_type: string;
  author_name: string | null;
  content_type: string;
  content_text: string | null;
  received_at: string;
  zendesk_timestamp: string | null;
}

export interface ConversationMessagesResponse {
  conversation_id: string;
  messages: Message[];
}

export interface UserConversation {
  id: number;
  zendesk_conversation_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserGroup {
  user_id: string;
  conversation_count: number;
  last_activity: string;
  first_activity: string;
  conversations: UserConversation[];
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

export interface ConversationWithMessages {
  conversation: {
    id: number;
    zendesk_conversation_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  messages: Message[];
  summary: ConversationSummary | null;
}

export interface UserConversationsMessagesResponse {
  user_id: string;
  conversations: ConversationWithMessages[];
}
