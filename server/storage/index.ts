// =============================================================================
// STORAGE AGGREGATOR
// =============================================================================
// This file provides a unified storage interface for cross-cutting concerns.
// For feature-specific code, prefer importing directly from the feature module:
//   import { conversationStorage } from "../features/conversations/storage/index.js";
//   import { eventStorage } from "../features/events/storage/index.js";
// =============================================================================

// --- Auth Domain ---
import { authStorage } from "../features/auth/storage/authStorage.js";

// --- Conversations Domain ---
import { userStorage } from "../features/conversations/storage/userStorage.js";
import { conversationStorage } from "../features/conversations/storage/index.js";

// --- Events Domain ---
import { eventStorage } from "../features/events/storage/eventStorage.js";

// --- AI Domain ---
import { configStorage } from "../features/ai/storage/configStorage.js";
import { classificationStorage } from "../features/ai/storage/classificationStorage.js";
import { summaryStorage } from "../features/ai/storage/summaryStorage.js";

// --- Cadastro Domain ---
import { usersStandardStorage } from "../features/cadastro/storage/usersStandardStorage.js";
import { organizationsStandardStorage } from "../features/cadastro/storage/organizationsStandardStorage.js";

// --- Export Domain ---
import { webhookStorage } from "../features/export/storage/webhookStorage.js";

// =============================================================================
// UNIFIED STORAGE OBJECT (for legacy/cross-cutting usage)
// =============================================================================
export const storage = {
  // Auth
  ...authStorage,
  // Conversations
  ...userStorage,
  ...conversationStorage,
  // Events
  ...eventStorage,
  // AI
  ...configStorage,
  ...classificationStorage,
  ...summaryStorage,
  // Cadastro
  ...usersStandardStorage,
  ...organizationsStandardStorage,
  // Export
  ...webhookStorage,
};

// =============================================================================
// NAMED EXPORTS BY DOMAIN
// =============================================================================

// --- Auth ---
export { authStorage } from "../features/auth/storage/authStorage.js";

// --- Conversations ---
export { userStorage } from "../features/conversations/storage/userStorage.js";
export { conversationStorage } from "../features/conversations/storage/index.js";

// --- Events ---
export { eventStorage } from "../features/events/storage/eventStorage.js";

// --- AI ---
export { configStorage } from "../features/ai/storage/configStorage.js";

// --- Cadastro ---
export { usersStandardStorage } from "../features/cadastro/storage/usersStandardStorage.js";
export { organizationsStandardStorage } from "../features/cadastro/storage/organizationsStandardStorage.js";

// --- Export ---
export { webhookStorage } from "../features/export/storage/webhookStorage.js";
