export interface WebhookLog {
  id: number;
  received_at: string;
  source_ip: string;
  processing_status: string;
  error_message: string | null;
  processed_at: string | null;
}

export interface WebhookLogDetail {
  id: number;
  received_at: string;
  source_ip: string;
  headers: Record<string, string>;
  payload: any;
  raw_body: string;
  processing_status: string;
  error_message: string | null;
  processed_at: string | null;
}

export interface WebhookLogsResponse {
  total: number;
  offset: number;
  limit: number;
  logs: WebhookLog[];
}

export interface StatsResponse {
  total: number;
  by_status: Record<string, number>;
}

export interface UserProfile {
  email?: string;
  givenName?: string;
  surname?: string;
  locale?: string;
}

export interface User {
  id: number;
  sunshine_id: string;
  external_id: string | null;
  authenticated: boolean;
  profile: UserProfile | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface UsersResponse {
  total: number;
  offset: number;
  limit: number;
  users: User[];
}

export interface UsersStatsResponse {
  total: number;
  authenticated: number;
  anonymous: number;
}

export interface ConversationsStatsResponse {
  total: number;
  active: number;
  closed: number;
  totalMessages: number;
}

export interface AuthorizedUser {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  createdBy: string | null;
}

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

export interface StandardEvent {
  id: number;
  event_type: string;
  event_subtype: string | null;
  source: string;
  source_event_id: string | null;
  external_conversation_id: string | null;
  external_user_id: string | null;
  author_type: string;
  author_id: string | null;
  author_name: string | null;
  content_text: string | null;
  content_payload: any;
  occurred_at: string;
  received_at: string;
  channel_type: string | null;
  metadata: any;
  display_name?: string | null;
  type_description?: string | null;
  show_in_list?: boolean | null;
  icon?: string | null;
}

export interface StandardEventsResponse {
  total: number;
  offset: number;
  limit: number;
  events: StandardEvent[];
}

export interface StandardEventsStatsResponse {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
}

export interface EventTypeMapping {
  id: number;
  source: string;
  event_type: string;
  display_name: string;
  description: string | null;
  show_in_list: boolean;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventTypeMappingsResponse {
  mappings: EventTypeMapping[];
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

export interface ConversationWithMessages {
  conversation: {
    id: number;
    zendesk_conversation_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  messages: Message[];
}

export interface UserConversationsMessagesResponse {
  user_id: string;
  conversations: ConversationWithMessages[];
}

export interface OpenaiSummaryConfigResponse {
  id?: number;
  enabled: boolean;
  trigger_event_types: string[];
  trigger_author_types: string[];
  prompt_template: string;
  model_name: string;
  created_at?: string;
  updated_at?: string;
}
