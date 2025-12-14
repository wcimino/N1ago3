import { authStorage } from "../features/auth/storage/authStorage.js";
import { userStorage } from "../features/conversations/storage/userStorage.js";
import { conversationStorage } from "../features/conversations/storage/index.js";

import { eventStorage } from "../features/events/storage/eventStorage.js";
import { usersStandardStorage } from "../features/cadastro/storage/usersStandardStorage.js";
import { organizationsStandardStorage } from "../features/cadastro/storage/organizationsStandardStorage.js";
import { knowledgeBaseStorage } from "../features/ai/storage/knowledgeBaseStorage.js";
import { knowledgeSuggestionsStorage } from "../features/ai/storage/knowledgeSuggestionsStorage.js";
import { configStorage } from "../features/ai/storage/configStorage.js";
import { classificationStorage } from "../features/ai/storage/classificationStorage.js";
import { summaryStorage } from "../features/ai/storage/summaryStorage.js";
import { webhookStorage } from "../features/export/storage/webhookStorage.js";

export const storage = {
  ...authStorage,
  ...webhookStorage,
  ...userStorage,
  ...conversationStorage,
  ...eventStorage,
  ...configStorage,
  ...classificationStorage,
  ...summaryStorage,
  ...usersStandardStorage,
  ...knowledgeBaseStorage,
  ...knowledgeSuggestionsStorage,
  ...organizationsStandardStorage,
};

export { authStorage } from "../features/auth/storage/authStorage.js";
export { userStorage } from "../features/conversations/storage/userStorage.js";
export { conversationStorage } from "../features/conversations/storage/index.js";

export { eventStorage } from "../features/events/storage/eventStorage.js";
export { usersStandardStorage } from "../features/cadastro/storage/usersStandardStorage.js";
export { organizationsStandardStorage } from "../features/cadastro/storage/organizationsStandardStorage.js";
export { knowledgeBaseStorage } from "../features/ai/storage/knowledgeBaseStorage.js";
export { knowledgeSuggestionsStorage } from "../features/ai/storage/knowledgeSuggestionsStorage.js";
export { configStorage } from "../features/ai/storage/configStorage.js";
export { webhookStorage } from "../features/export/storage/webhookStorage.js";
