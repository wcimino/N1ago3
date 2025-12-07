export const CONVERSATION_RULES = {
  INACTIVITY_TIMEOUT_MINUTES: 60,
  AUTO_CLOSE_ENABLED: false,
  CLOSE_PREVIOUS_ON_NEW: true,
};

export type ClosedReason = 'inactivity' | 'new_conversation' | 'manual' | 'external';

export type ConversationStatus = 'active' | 'closed';
