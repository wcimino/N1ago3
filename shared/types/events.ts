import type { AuthorType } from "./common.js";

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

export interface StandardEventInput {
  eventType: string;
  eventSubtype?: string;
  source: string;
  sourceEventId?: string;
  externalConversationId?: string;
  externalUserId?: string;
  authorType: AuthorType;
  authorId?: string;
  authorName?: string;
  contentText?: string;
  contentPayload?: any;
  occurredAt: Date;
  channelType?: string;
  metadata?: any;
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
