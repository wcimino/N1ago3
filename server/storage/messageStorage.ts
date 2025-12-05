import { db } from "../db.js";
import { messages } from "../../shared/schema.js";

export const messageStorage = {
  async saveMessage(conversationId: number, messageData: any, webhookLogId?: number) {
    const author = messageData.author || {};
    const content = messageData.content || {};
    
    let zendeskTimestamp: Date | null = null;
    if (messageData.received) {
      try {
        zendeskTimestamp = new Date(messageData.received);
      } catch {}
    }
    
    const [message] = await db.insert(messages).values({
      conversationId,
      zendeskMessageId: messageData.id,
      authorType: author.type || "unknown",
      authorId: author.userId || author.appId,
      authorName: author.displayName,
      contentType: content.type || "text",
      contentText: content.text,
      contentPayload: content.type !== "text" ? content : null,
      zendeskTimestamp,
      metadataJson: messageData.metadata,
      webhookLogId,
    }).returning();
    
    return message;
  },
};
