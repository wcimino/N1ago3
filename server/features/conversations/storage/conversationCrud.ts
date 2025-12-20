import { db } from "../../../db.js";
import { conversations, eventsStandard, conversationsSummary } from "../../../../shared/schema.js";
import { eq, desc, sql, and, lt, ne } from "drizzle-orm";
import type { ExtractedConversation } from "../../events/adapters/types.js";
import { CONVERSATION_RULES, type ClosedReason } from "../../../config/conversationRules.js";
import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";
import { createConversationClosedEvent } from "./conversationEvents.js";

interface ConversationData {
  externalConversationId: string;
  externalAppId?: string;
  externalUserId?: string;
  userExternalId?: string;
  metadata?: any;
}

async function upsertConversation(data: ConversationData): Promise<{ conversation: typeof conversations.$inferSelect; isNew: boolean }> {
  const existing = await db.select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.externalConversationId, data.externalConversationId))
    .limit(1);
  
  const isNewConversation = existing.length === 0;

  const [conversation] = await db.insert(conversations)
    .values({
      externalConversationId: data.externalConversationId,
      externalAppId: data.externalAppId,
      userId: data.externalUserId,
      userExternalId: data.userExternalId,
      metadataJson: data.metadata,
      currentHandler: ZendeskApiService.getAnswerBotIntegrationId(),
      currentHandlerName: "zd-answerBot",
    })
    .onConflictDoUpdate({
      target: conversations.externalConversationId,
      set: {
        updatedAt: new Date(),
        userId: sql`CASE WHEN ${conversations.userId} IS NULL THEN excluded.user_id ELSE ${conversations.userId} END`,
        userExternalId: sql`CASE WHEN ${conversations.userExternalId} IS NULL THEN excluded.user_external_id ELSE ${conversations.userExternalId} END`,
        metadataJson: sql`CASE WHEN ${conversations.metadataJson} IS NULL THEN excluded.metadata_json ELSE ${conversations.metadataJson} END`,
      },
    })
    .returning();
  
  if (isNewConversation && data.userExternalId && CONVERSATION_RULES.CLOSE_PREVIOUS_ON_NEW) {
    try {
      const closed = await closePreviousConversationsForUser(data.userExternalId, conversation.id);
      if (closed.length > 0) {
        console.log(`Closed ${closed.length} previous conversations for user ${data.userExternalId}`);
      }
    } catch (error) {
      console.error(`Failed to close previous conversations for user ${data.userExternalId}:`, error);
    }
  }
  
  return { conversation, isNew: isNewConversation };
}

async function closePreviousConversationsForUser(userExternalId: string, excludeConversationId: number) {
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
}

export const conversationCrud = {
  async getOrCreateConversation(externalConversationId: string, externalAppId?: string, userData?: any) {
    return upsertConversation({
      externalConversationId: externalConversationId,
      externalAppId: externalAppId,
      externalUserId: userData?.id,
      userExternalId: userData?.externalId,
      metadata: userData,
    });
  },

  async getConversations(limit = 50, offset = 0) {
    const convs = await db.select().from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(conversations);
    
    return { conversations: convs, total: Number(count) };
  },

  async getConversationMessages(externalConversationId: string) {
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.externalConversationId, externalConversationId));
    
    if (!conversation) return null;
    
    const msgs = await db.select()
      .from(eventsStandard)
      .where(and(
        eq(eventsStandard.conversationId, conversation.id),
        eq(eventsStandard.eventType, 'message')
      ))
      .orderBy(eventsStandard.occurredAt);
    
    return { 
      conversation, 
      messages: msgs.map(e => ({
        id: e.id,
        conversationId: e.conversationId,
        zendeskMessageId: e.sourceEventId,
        authorType: e.authorType,
        authorId: e.authorId,
        authorName: e.authorName,
        contentType: e.eventSubtype || 'text',
        contentText: e.contentText,
        contentPayload: e.contentPayload,
        zendeskTimestamp: e.occurredAt,
        receivedAt: e.receivedAt,
        metadataJson: e.metadata,
      }))
    };
  },

  async getOrCreateConversationByExternalId(data: ExtractedConversation) {
    return upsertConversation({
      externalConversationId: data.externalConversationId,
      externalAppId: data.externalAppId,
      externalUserId: data.externalUserId,
      userExternalId: data.userExternalId,
      metadata: data.metadata,
    });
  },

  async updateConversationHandler(externalConversationId: string, handlerId: string, handlerName: string) {
    const isN1ago = handlerName?.toLowerCase().includes("n1ago");
    
    const updateData: Record<string, unknown> = {
      currentHandler: handlerId,
      currentHandlerName: handlerName,
      updatedAt: new Date(),
    };
    
    if (isN1ago) {
      updateData.handledByN1ago = true;
      updateData.autopilotEnabled = true;
    }
    
    const result = await db.update(conversations)
      .set(updateData)
      .where(eq(conversations.externalConversationId, externalConversationId))
      .returning();
    
    return result[0] || null;
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

  async updateExternalStatus(externalConversationId: string, externalStatus: string) {
    const result = await db.update(conversations)
      .set({
        externalStatus,
        updatedAt: new Date(),
      })
      .where(eq(conversations.externalConversationId, externalConversationId))
      .returning();
    
    return result[0] || null;
  },

  async updateConversationAutopilot(conversationId: number, enabled: boolean) {
    const result = await db.update(conversations)
      .set({
        autopilotEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    
    return result[0] || null;
  },

  async getById(conversationId: number) {
    const result = await db.select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    return result[0] || null;
  },

  async updateOrchestratorStatus(conversationId: number, orchestratorStatus: string) {
    const result = await db.update(conversationsSummary)
      .set({
        orchestratorStatus,
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId))
      .returning();
    
    if (result[0]) {
      return result[0];
    }
    
    const now = new Date();
    const insertResult = await db.insert(conversationsSummary)
      .values({
        conversationId,
        summary: "",
        orchestratorStatus,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: conversationsSummary.conversationId,
        set: { orchestratorStatus, updatedAt: now },
      })
      .returning();
    
    return insertResult[0] || null;
  },

  async getOrchestratorStatus(conversationId: number): Promise<string | null> {
    const result = await db.select({ orchestratorStatus: conversationsSummary.orchestratorStatus })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);
    
    return result[0]?.orchestratorStatus || null;
  },

};
