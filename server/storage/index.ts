import { authStorage } from "../features/auth/storage.js";
import { webhookStorage } from "../features/events/webhookStorage.js";
import { userStorage } from "../features/users/userStorage.js";
import { conversationStorage } from "../features/conversations/storage.js";
import { eventStorage } from "../features/events/storage.js";
import { configStorage } from "../features/ai/configStorage.js";
import { usersStandardStorage } from "../features/users/storage.js";

export const storage = {
  ...authStorage,
  ...webhookStorage,
  ...userStorage,
  ...conversationStorage,
  ...eventStorage,
  ...configStorage,
  ...usersStandardStorage,
};

export { authStorage } from "../features/auth/storage.js";
export { webhookStorage } from "../features/events/webhookStorage.js";
export { userStorage } from "../features/users/userStorage.js";
export { conversationStorage } from "../features/conversations/storage.js";
export { eventStorage } from "../features/events/storage.js";
export { configStorage } from "../features/ai/configStorage.js";
export { usersStandardStorage } from "../features/users/storage.js";
