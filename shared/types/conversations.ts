import type { UserProfile } from "./users.js";

export interface Conversation {
  id: number;
  external_conversation_id: string;
  external_app_id: string | null;
  user_id: string | null;
  status: string;
  external_status: string | null;
  closed_at: string | null;
  closed_reason: string | null;
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
  author_id: string | null;
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
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
  product_standard: string | null;
  intent: string | null;
  current_handler: string | null;
  current_handler_name: string | null;
  message_count: number;
}

export interface UserGroup {
  user_id: string;
  conversation_count: number;
  last_activity: string;
  first_activity: string;
  latest_conversation_start?: string;
  conversations: UserConversation[];
  last_product_standard: string | null;
  last_subproduct_standard: string | null;
  last_subject: string | null;
  last_intent: string | null;
  last_customer_emotion_level: number | null;
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

export interface ConversationListItem {
  id: number;
  external_conversation_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_reason: string | null;
  current_handler: string | null;
  current_handler_name: string | null;
  message_count: number;
  product_standard: string | null;
  subproduct_standard: string | null;
  subject: string | null;
  intent: string | null;
  customer_emotion_level: number | null;
  user_info: {
    id: number;
    external_id: string | null;
    authenticated: boolean;
    profile: UserProfile | null;
  } | null;
}

export interface ConversationListResponse {
  total: number;
  offset: number;
  limit: number;
  conversations: ConversationListItem[];
}

export interface TriageAnamnese {
  customerMainComplaint: string | null;
  customerRequestType: string | null;
  customerDeclaredObjective: string | null;
  customerDeclaredHypothesis: string | null;
  customerKeyContext: string[];
}

export interface TriageSeverity {
  level: "low" | "medium" | "high" | "critical" | string;
  redFlags: string[];
  rationale: string | null;
}

export interface Triage {
  anamnese: TriageAnamnese;
  objectiveProblems: (string | ObjectiveProblemIdentified)[];
  severity: TriageSeverity;
}

export interface ObjectiveProblemIdentified {
  id: number;
  name: string;
  matchScore?: number;
}

export interface ConversationSummary {
  text: string;
  generated_at: string | null;
  updated_at: string | null;
  product: string | null;
  subproduct: string | null;
  subject: string | null;
  intent: string | null;
  confidence: number | null;
  classified_at: string | null;
  client_request: string | null;
  agent_actions: string | null;
  current_status: string | null;
  important_info: string | null;
  customer_emotion_level: number | null;
  customer_request_type: string | null;
  objective_problems: ObjectiveProblemIdentified[] | null;
  triage: Triage | null;
}

export interface ArticleUsed {
  id: number;
  name: string;
  product: string;
  url?: string;
}

export interface SuggestedResponse {
  text: string;
  created_at: string;
  last_event_id: number | null;
  status: string | null;
  articles_used?: ArticleUsed[] | null;
}

export interface ConversationWithMessages {
  conversation: {
    id: number;
    external_conversation_id: string;
    status: string;
    current_handler: string | null;
    current_handler_name: string | null;
    closed_at: string | null;
    closed_reason: string | null;
    created_at: string;
    updated_at: string;
    autopilot_enabled: boolean;
  };
  messages: Message[];
  summary: ConversationSummary | null;
  suggested_responses: SuggestedResponse[];
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
