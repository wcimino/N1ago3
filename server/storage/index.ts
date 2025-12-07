import { authStorage } from "./authStorage.js";
import { userStorage } from "./userStorage.js";
import { conversationStorage } from "./conversationStorage.js";

import { eventStorage } from "../features/events/storage/eventStorage.js";
import { usersStandardStorage } from "../features/cadastro/storage/usersStandardStorage.js";
import { organizationsStandardStorage } from "../features/cadastro/storage/organizationsStandardStorage.js";
import { knowledgeBaseStorage } from "../features/ai/storage/knowledgeBaseStorage.js";
import { configStorage } from "../features/ai/storage/configStorage.js";
import { webhookStorage } from "../features/export/storage/webhookStorage.js";

export const storage = {
  ...authStorage,
  ...webhookStorage,
  ...userStorage,
  ...conversationStorage,
  ...eventStorage,
  ...configStorage,
  ...usersStandardStorage,
  ...knowledgeBaseStorage,
  ...organizationsStandardStorage,
};

export { authStorage } from "./authStorage.js";
export { userStorage } from "./userStorage.js";
export { conversationStorage } from "./conversationStorage.js";

export { eventStorage } from "../features/events/storage/eventStorage.js";
export { usersStandardStorage } from "../features/cadastro/storage/usersStandardStorage.js";
export { organizationsStandardStorage } from "../features/cadastro/storage/organizationsStandardStorage.js";
export { knowledgeBaseStorage } from "../features/ai/storage/knowledgeBaseStorage.js";
export { configStorage } from "../features/ai/storage/configStorage.js";
export { webhookStorage } from "../features/export/storage/webhookStorage.js";
