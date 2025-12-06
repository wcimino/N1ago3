import { authStorage } from "./authStorage.js";
import { webhookStorage } from "./webhookStorage.js";
import { userStorage } from "./userStorage.js";
import { conversationStorage } from "./conversationStorage.js";
import { eventStorage } from "./eventStorage.js";
import { configStorage } from "./configStorage.js";
import { usersStandardStorage } from "./usersStandardStorage.js";

export const storage = {
  ...authStorage,
  ...webhookStorage,
  ...userStorage,
  ...conversationStorage,
  ...eventStorage,
  ...configStorage,
  ...usersStandardStorage,
};

export { authStorage } from "./authStorage.js";
export { webhookStorage } from "./webhookStorage.js";
export { userStorage } from "./userStorage.js";
export { conversationStorage } from "./conversationStorage.js";
export { eventStorage } from "./eventStorage.js";
export { configStorage } from "./configStorage.js";
export { usersStandardStorage } from "./usersStandardStorage.js";
