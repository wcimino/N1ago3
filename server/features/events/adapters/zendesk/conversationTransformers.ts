import type { ExtractedConversation } from "../types.js";

export function extractConversation(rawPayload: any): ExtractedConversation | null {
  const events = rawPayload.events || [];
  
  for (const event of events) {
    const payload = event.payload || {};
    const conversationData = payload.conversation || rawPayload.conversation;
    
    if (conversationData?.id) {
      const userData = payload.user || rawPayload.user;
      
      return {
        externalConversationId: conversationData.id,
        externalAppId: rawPayload.app?.id,
        externalUserId: userData?.id,
        userExternalId: userData?.externalId,
        metadata: conversationData,
      };
    }
  }

  if (rawPayload.conversation?.id) {
    return {
      externalConversationId: rawPayload.conversation.id,
      externalAppId: rawPayload.app?.id,
      externalUserId: rawPayload.user?.id,
      userExternalId: rawPayload.user?.externalId,
      metadata: rawPayload.conversation,
    };
  }

  return null;
}
