import { conversationCrud } from "./conversationCrud.js";
import { conversationStats } from "./conversationStats.js";

export const conversationStorage = {
  ...conversationCrud,
  ...conversationStats,
};
