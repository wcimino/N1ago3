import { conversationStorage } from "../../../conversations/storage/index.js";
import { ZendeskApiService } from "../../../external-sources/zendesk/services/zendeskApiService.js";

export async function isN1agoHandler(conversationId: number): Promise<boolean> {
  const conversation = await conversationStorage.getById(conversationId);
  if (!conversation) {
    return false;
  }
  
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  return conversation.currentHandler === n1agoIntegrationId || 
    conversation.currentHandlerName?.startsWith("n1ago") || false;
}
