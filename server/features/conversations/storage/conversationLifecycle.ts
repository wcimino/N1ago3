import { db } from "../../../db.js";
import { conversations } from "../../../../shared/schema.js";
import { eq, and, lt, ne, sql } from "drizzle-orm";
import { CONVERSATION_RULES, type ClosedReason } from "../../../config/conversationRules.js";
import { createConversationClosedEvent } from "./conversationEvents.js";

export const conversationLifecycle = {
  async closePreviousConversationsForUser(userExternalId: string, excludeConversationId: number) {
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'new_conversation',
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversations.userExternalId, userExternalId),
        eq(conversations.status, 'active'),
        ne(conversations.id, excludeConversationId)
      ))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'new_conversation');
    }
    
    return result;
  },

  async closeConversation(conversationId: number, reason: ClosedReason) {
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    
    if (result[0]) {
      await createConversationClosedEvent(result[0], reason);
    }
    
    return result[0] || null;
  },

  async closeUserPreviousConversations(userExternalId: string, excludeConversationId?: number) {
    const conditions = [
      eq(conversations.userExternalId, userExternalId),
      eq(conversations.status, 'active'),
    ];
    
    if (excludeConversationId) {
      conditions.push(ne(conversations.id, excludeConversationId));
    }

    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'new_conversation',
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'new_conversation');
    }
    
    return result;
  },

  async getInactiveConversations(limit: number = 10) {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await db.select()
      .from(conversations)
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime)
      ))
      .orderBy(conversations.updatedAt)
      .limit(limit);
    
    return result;
  },

  async closeInactiveConversations(limit: number = 10) {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'inactivity',
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime),
        sql`id IN (SELECT id FROM conversations WHERE status = 'active' AND updated_at < ${cutoffTime} ORDER BY updated_at LIMIT ${limit})`
      ))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'inactivity');
    }
    
    return result;
  },

  async countInactiveConversations() {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime)
      ));
    
    return Number(count);
  },

  async closeInactiveConversationsManual(limit: number = 10) {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'manual',
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime),
        sql`id IN (SELECT id FROM conversations WHERE status = 'active' AND updated_at < ${cutoffTime} ORDER BY updated_at LIMIT ${limit})`
      ))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'manual');
    }
    
    return result;
  },
};
