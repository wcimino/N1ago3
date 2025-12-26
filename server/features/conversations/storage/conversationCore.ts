import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import type { ExtractedConversation } from "../../events/adapters/types.js";
import { CONVERSATION_RULES } from "../../../config/conversationRules.js";
import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";
import { createConversationClosedEvent } from "./conversationEvents.js";
import { fetchClientByAccountRef } from "../../../shared/services/clientHubClient.js";
import { summaryStorage } from "../../ai/storage/summaryStorage.js";

interface ConversationData {
  externalConversationId: string;
  externalAppId?: string;
  externalUserId?: string;
  userExternalId?: string;
  metadata?: any;
}

async function closePreviousConversationsForUserInternal(userExternalId: string, excludeConversationId: number) {
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

export async function upsertConversation(data: ConversationData): Promise<{ conversation: typeof conversations.$inferSelect; isNew: boolean }> {
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
      const closed = await closePreviousConversationsForUserInternal(data.userExternalId, conversation.id);
      if (closed.length > 0) {
        console.log(`Closed ${closed.length} previous conversations for user ${data.userExternalId}`);
      }
    } catch (error) {
      console.error(`Failed to close previous conversations for user ${data.userExternalId}:`, error);
    }
  }
  
  if (isNewConversation) {
    const accountRef = data.userExternalId || 
      data.metadata?.metadata?.['zen:ticket_field:17571800295309'];
    
    if (accountRef) {
      fetchClientHubDataAsync(conversation.id, accountRef);
    }
  }
  
  return { conversation, isNew: isNewConversation };
}

async function fetchClientHubDataAsync(conversationId: number, accountRef: string): Promise<void> {
  try {
    console.log(`[ClientHubIntegration] Fetching client data for conversation ${conversationId}, accountRef: ${accountRef}`);
    const clientData = await fetchClientByAccountRef(accountRef, { conversationId });
    
    if (clientData) {
      await summaryStorage.updateClientHubData(conversationId, clientData);
      console.log(`[ClientHubIntegration] Successfully saved client data for conversation ${conversationId}`);
    } else {
      console.log(`[ClientHubIntegration] No client data found for accountRef: ${accountRef}`);
    }
  } catch (error) {
    console.error(`[ClientHubIntegration] Failed to fetch client data for conversation ${conversationId}:`, error);
  }
}

export const conversationCore = {
  upsertConversation,

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
};
