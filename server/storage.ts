import { db } from "./db";
import { webhookRawLogs, conversations, messages } from "../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { InsertWebhookRawLog, InsertConversation, InsertMessage } from "../shared/schema";

export const storage = {
  async createWebhookLog(data: InsertWebhookRawLog) {
    const [log] = await db.insert(webhookRawLogs).values(data).returning();
    return log;
  },

  async updateWebhookLogStatus(id: number, status: string, errorMessage?: string) {
    await db.update(webhookRawLogs)
      .set({
        processingStatus: status,
        processedAt: new Date(),
        errorMessage: errorMessage || null,
      })
      .where(eq(webhookRawLogs.id, id));
  },

  async getWebhookLogs(limit = 50, offset = 0, status?: string) {
    let query = db.select().from(webhookRawLogs).orderBy(desc(webhookRawLogs.receivedAt));
    
    if (status) {
      query = query.where(eq(webhookRawLogs.processingStatus, status)) as typeof query;
    }
    
    const logs = await query.limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(webhookRawLogs);
    
    return { logs, total: Number(count) };
  },

  async getWebhookLogById(id: number) {
    const [log] = await db.select().from(webhookRawLogs).where(eq(webhookRawLogs.id, id));
    return log;
  },

  async getWebhookLogsStats() {
    const stats = await db.select({
      status: webhookRawLogs.processingStatus,
      count: sql<number>`count(*)`,
    })
      .from(webhookRawLogs)
      .groupBy(webhookRawLogs.processingStatus);
    
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(webhookRawLogs);
    
    return {
      total: Number(total),
      byStatus: Object.fromEntries(stats.map(s => [s.status, Number(s.count)])),
    };
  },

  async getOrCreateConversation(zendeskConversationId: string, zendeskAppId?: string, userData?: any) {
    let [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.zendeskConversationId, zendeskConversationId));
    
    if (!conversation) {
      [conversation] = await db.insert(conversations).values({
        zendeskConversationId,
        zendeskAppId,
        userId: userData?.id,
        userExternalId: userData?.externalId,
        metadataJson: userData,
      }).returning();
    } else {
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));
    }
    
    return conversation;
  },

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

  async getConversations(limit = 50, offset = 0) {
    const convs = await db.select().from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(conversations);
    
    return { conversations: convs, total: Number(count) };
  },

  async getConversationMessages(zendeskConversationId: string) {
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.zendeskConversationId, zendeskConversationId));
    
    if (!conversation) return null;
    
    const msgs = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(messages.receivedAt);
    
    return { conversation, messages: msgs };
  },
};
