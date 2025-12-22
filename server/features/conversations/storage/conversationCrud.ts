import { conversationCore, upsertConversation } from "./conversationCore.js";
import { conversationLifecycle } from "./conversationLifecycle.js";
import { conversationOrchestratorState } from "./conversationOrchestratorState.js";

export { upsertConversation };

export const conversationCrud = {
  ...conversationCore,
  ...conversationLifecycle,
  ...conversationOrchestratorState,
};
