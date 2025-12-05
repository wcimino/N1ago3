import { db } from "./db.js";
import { zendeskConversationsWebhookRaw, eventsStandard, conversations, messages, users, authUsers, authorizedUsers, eventTypeMapping } from "../shared/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import type { InsertZendeskConversationsWebhookRaw, InsertConversation, InsertMessage, User, UpsertAuthUser, AuthUser, AuthorizedUser, InsertAuthorizedUser, InsertEventStandard, EventStandard, ZendeskConversationsWebhookRaw, EventTypeMapping, InsertEventTypeMapping } from "../shared/schema.js";
import type { ExtractedUser, ExtractedConversation, StandardEvent } from "./adapters/types.js";

export const storage = {
  // Auth User operations for Replit Auth
  async getAuthUser(id: string): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    return user;
  },

  async upsertAuthUser(userData: UpsertAuthUser): Promise<AuthUser> {
    const [user] = await db
      .insert(authUsers)
      .values(userData)
      .onConflictDoUpdate({
        target: authUsers.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  },

  // Authorized users operations
  async isUserAuthorized(email: string): Promise<boolean> {
    const [user] = await db.select()
      .from(authorizedUsers)
      .where(eq(authorizedUsers.email, email.toLowerCase()));
    return !!user;
  },

  async getAuthorizedUsers(): Promise<AuthorizedUser[]> {
    return await db.select()
      .from(authorizedUsers)
      .orderBy(desc(authorizedUsers.createdAt));
  },

  async addAuthorizedUser(data: InsertAuthorizedUser): Promise<AuthorizedUser> {
    const [user] = await db.insert(authorizedUsers)
      .values({
        ...data,
        email: data.email.toLowerCase(),
      })
      .returning();
    return user;
  },

  async removeAuthorizedUser(id: number): Promise<boolean> {
    const result = await db.delete(authorizedUsers)
      .where(eq(authorizedUsers.id, id));
    return true;
  },

  // Webhook operations
  async createWebhookLog(data: InsertZendeskConversationsWebhookRaw) {
    const [log] = await db.insert(zendeskConversationsWebhookRaw).values(data).returning();
    return log;
  },

  async updateWebhookLogStatus(id: number, status: string, errorMessage?: string) {
    await db.update(zendeskConversationsWebhookRaw)
      .set({
        processingStatus: status,
        processedAt: new Date(),
        errorMessage: errorMessage || null,
      })
      .where(eq(zendeskConversationsWebhookRaw.id, id));
  },

  async getWebhookLogs(limit = 50, offset = 0, status?: string, sunshineId?: string) {
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(zendeskConversationsWebhookRaw.processingStatus, status));
    }
    
    if (sunshineId) {
      conditions.push(sql`${zendeskConversationsWebhookRaw.payload}::text LIKE ${'%' + sunshineId + '%'}`);
    }
    
    let query = db.select().from(zendeskConversationsWebhookRaw).orderBy(desc(zendeskConversationsWebhookRaw.receivedAt));
    
    if (conditions.length > 0) {
      for (const condition of conditions) {
        query = query.where(condition) as typeof query;
      }
    }
    
    const logs = await query.limit(limit).offset(offset);
    
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(zendeskConversationsWebhookRaw);
    if (conditions.length > 0) {
      for (const condition of conditions) {
        countQuery = countQuery.where(condition) as typeof countQuery;
      }
    }
    const [{ count }] = await countQuery;
    
    return { logs, total: Number(count) };
  },

  async getWebhookLogById(id: number) {
    const [log] = await db.select().from(zendeskConversationsWebhookRaw).where(eq(zendeskConversationsWebhookRaw.id, id));
    return log;
  },

  async getWebhookLogsStats() {
    const stats = await db.select({
      status: zendeskConversationsWebhookRaw.processingStatus,
      count: sql<number>`count(*)`,
    })
      .from(zendeskConversationsWebhookRaw)
      .groupBy(zendeskConversationsWebhookRaw.processingStatus);
    
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(zendeskConversationsWebhookRaw);
    
    return {
      total: Number(total),
      byStatus: Object.fromEntries(stats.map((s: { status: string; count: number }) => [s.status, Number(s.count)])),
    };
  },

  async upsertUser(userData: any): Promise<User | null> {
    if (!userData?.id) {
      return null;
    }

    const sunshineId = userData.id;
    let signedUpAt: Date | null = null;
    if (userData.signedUpAt) {
      try {
        signedUpAt = new Date(userData.signedUpAt);
      } catch {}
    }

    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.sunshineId, sunshineId));

    if (existingUser) {
      const [updated] = await db.update(users)
        .set({
          externalId: userData.externalId || existingUser.externalId,
          signedUpAt: signedUpAt || existingUser.signedUpAt,
          authenticated: userData.authenticated ?? existingUser.authenticated,
          profile: userData.profile || existingUser.profile,
          metadata: userData.metadata || existingUser.metadata,
          identities: userData.identities || existingUser.identities,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated;
    }

    const [newUser] = await db.insert(users)
      .values({
        sunshineId,
        externalId: userData.externalId || null,
        signedUpAt,
        authenticated: userData.authenticated ?? false,
        profile: userData.profile || null,
        metadata: userData.metadata || null,
        identities: userData.identities || null,
      })
      .returning();
    
    return newUser;
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
      const updates: any = { updatedAt: new Date() };
      
      if (!conversation.userId && userData?.id) {
        updates.userId = userData.id;
        updates.userExternalId = userData.externalId;
        updates.metadataJson = userData;
      }
      
      [conversation] = await db.update(conversations)
        .set(updates)
        .where(eq(conversations.id, conversation.id))
        .returning();
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

  async getUsers(limit = 50, offset = 0) {
    const usersList = await db.select().from(users)
      .orderBy(desc(users.lastSeenAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    
    return { users: usersList, total: Number(count) };
  },

  async getUsersStats() {
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(users);
    const [{ authenticated }] = await db.select({ 
      authenticated: sql<number>`count(*) filter (where authenticated = true)` 
    }).from(users);
    
    return {
      total: Number(total),
      authenticated: Number(authenticated),
      anonymous: Number(total) - Number(authenticated),
    };
  },

  async getConversationsStats() {
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(conversations);
    const [{ active }] = await db.select({ 
      active: sql<number>`count(*) filter (where status = 'active')` 
    }).from(conversations);
    const [{ totalMessages }] = await db.select({ 
      totalMessages: sql<number>`count(*) filter (where event_type = 'message')` 
    }).from(eventsStandard);
    
    return {
      total: Number(total),
      active: Number(active),
      closed: Number(total) - Number(active),
      totalMessages: Number(totalMessages),
    };
  },

  async getConversationsGroupedByUser(limit = 50, offset = 0) {
    const userConversations = await db.execute(sql`
      WITH user_stats AS (
        SELECT 
          user_id,
          COUNT(*) as conversation_count,
          MAX(updated_at) as last_activity,
          MIN(created_at) as first_activity,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'zendesk_conversation_id', zendesk_conversation_id,
              'status', status,
              'created_at', TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'updated_at', TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ) ORDER BY created_at ASC
          ) as conversations
        FROM conversations
        WHERE user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY last_activity DESC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT 
        user_id,
        conversation_count,
        TO_CHAR(last_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_activity,
        TO_CHAR(first_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as first_activity,
        conversations
      FROM user_stats
    `);

    const [{ count }] = await db.select({ 
      count: sql<number>`COUNT(DISTINCT user_id)` 
    }).from(conversations).where(sql`user_id IS NOT NULL`);

    return { 
      userGroups: userConversations.rows as any[], 
      total: Number(count) 
    };
  },

  async getUserConversationsWithMessages(userId: string) {
    const userConvs = await db.select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.createdAt);

    if (userConvs.length === 0) return null;

    const conversationsWithMessages = await Promise.all(
      userConvs.map(async (conv) => {
        const msgs = await db.select()
          .from(eventsStandard)
          .where(and(
            eq(eventsStandard.conversationId, conv.id),
            eq(eventsStandard.eventType, 'message')
          ))
          .orderBy(eventsStandard.occurredAt);
        
        return {
          conversation: conv,
          messages: msgs.map(e => ({
            id: e.id,
            author_type: e.authorType,
            author_name: e.authorName,
            content_type: e.eventSubtype || 'text',
            content_text: e.contentText,
            received_at: e.receivedAt?.toISOString(),
            zendesk_timestamp: e.occurredAt?.toISOString(),
          })),
        };
      })
    );

    return conversationsWithMessages;
  },

  async getUserBySunshineId(sunshineId: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.sunshineId, sunshineId));
    return user || null;
  },

  // Webhook raw operations (using zendesk_conversations_webhook_raw as canonical source)
  async getWebhookRawById(id: number, source: string): Promise<ZendeskConversationsWebhookRaw | null> {
    if (source !== "zendesk") {
      console.warn(`Unknown source: ${source}, only zendesk is supported`);
      return null;
    }
    const [raw] = await db.select().from(zendeskConversationsWebhookRaw).where(eq(zendeskConversationsWebhookRaw.id, id));
    return raw || null;
  },

  async updateWebhookRawStatus(id: number, source: string, status: string, errorMessage?: string) {
    if (source !== "zendesk") {
      console.warn(`Unknown source: ${source}, only zendesk is supported`);
      return;
    }
    if (status === "error") {
      await db.update(zendeskConversationsWebhookRaw)
        .set({
          processingStatus: status,
          processedAt: new Date(),
          errorMessage: errorMessage || null,
          retryCount: sql`${zendeskConversationsWebhookRaw.retryCount} + 1`,
        })
        .where(eq(zendeskConversationsWebhookRaw.id, id));
    } else {
      await db.update(zendeskConversationsWebhookRaw)
        .set({
          processingStatus: status,
          processedAt: new Date(),
          errorMessage: errorMessage || null,
        })
        .where(eq(zendeskConversationsWebhookRaw.id, id));
    }
  },

  async getPendingWebhookRaws(source: string, limit = 100): Promise<ZendeskConversationsWebhookRaw[]> {
    if (source !== "zendesk") {
      console.warn(`Unknown source: ${source}, only zendesk is supported`);
      return [];
    }
    return await db.select()
      .from(zendeskConversationsWebhookRaw)
      .where(
        and(
          eq(zendeskConversationsWebhookRaw.processingStatus, "pending"),
          sql`${zendeskConversationsWebhookRaw.retryCount} < 5`
        )
      )
      .orderBy(zendeskConversationsWebhookRaw.receivedAt)
      .limit(limit);
  },

  async getWebhookRawsStats() {
    const stats = await db.select({
      status: zendeskConversationsWebhookRaw.processingStatus,
      source: zendeskConversationsWebhookRaw.source,
      count: sql<number>`count(*)`,
    })
      .from(zendeskConversationsWebhookRaw)
      .groupBy(zendeskConversationsWebhookRaw.processingStatus, zendeskConversationsWebhookRaw.source);
    
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(zendeskConversationsWebhookRaw);
    
    return {
      total: Number(total),
      byStatusAndSource: stats,
    };
  },

  // User operations by external ID (for adapters)
  async upsertUserByExternalId(userData: ExtractedUser): Promise<User | null> {
    if (!userData?.externalId) {
      return null;
    }

    const sunshineId = userData.externalId;

    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.sunshineId, sunshineId));

    if (existingUser) {
      const [updated] = await db.update(users)
        .set({
          signedUpAt: userData.signedUpAt || existingUser.signedUpAt,
          authenticated: userData.authenticated ?? existingUser.authenticated,
          profile: userData.profile || existingUser.profile,
          metadata: userData.metadata || existingUser.metadata,
          identities: userData.identities || existingUser.identities,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated;
    }

    const [newUser] = await db.insert(users)
      .values({
        sunshineId,
        externalId: null,
        signedUpAt: userData.signedUpAt || null,
        authenticated: userData.authenticated ?? false,
        profile: userData.profile || null,
        metadata: userData.metadata || null,
        identities: userData.identities || null,
      })
      .returning();
    
    return newUser;
  },

  // Conversation operations by external ID (for adapters)
  async getOrCreateConversationByExternalId(data: ExtractedConversation) {
    let [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.zendeskConversationId, data.externalConversationId));
    
    if (!conversation) {
      [conversation] = await db.insert(conversations).values({
        zendeskConversationId: data.externalConversationId,
        zendeskAppId: data.externalAppId,
        userId: data.externalUserId,
        userExternalId: data.userExternalId,
        metadataJson: data.metadata,
      }).returning();
    } else {
      const updates: any = { updatedAt: new Date() };
      
      if (!conversation.userId && data.externalUserId) {
        updates.userId = data.externalUserId;
        updates.userExternalId = data.userExternalId;
        updates.metadataJson = data.metadata;
      }
      
      [conversation] = await db.update(conversations)
        .set(updates)
        .where(eq(conversations.id, conversation.id))
        .returning();
    }
    
    return conversation;
  },

  // Standard events operations
  async saveStandardEvent(event: StandardEvent & { sourceRawId?: number; conversationId?: number; userId?: number }): Promise<EventStandard> {
    const [saved] = await db.insert(eventsStandard).values({
      eventType: event.eventType,
      eventSubtype: event.eventSubtype,
      source: event.source,
      sourceEventId: event.sourceEventId,
      sourceRawId: event.sourceRawId,
      conversationId: event.conversationId,
      externalConversationId: event.externalConversationId,
      userId: event.userId,
      externalUserId: event.externalUserId,
      authorType: event.authorType,
      authorId: event.authorId,
      authorName: event.authorName,
      contentText: event.contentText,
      contentPayload: event.contentPayload,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      channelType: event.channelType,
      processingStatus: "processed",
    }).returning();
    
    return saved;
  },

  async getStandardEvents(limit = 50, offset = 0, filters?: { source?: string; eventType?: string; conversationId?: number }) {
    let query = db.select().from(eventsStandard).orderBy(desc(eventsStandard.occurredAt));
    
    if (filters?.source) {
      query = query.where(eq(eventsStandard.source, filters.source)) as typeof query;
    }
    if (filters?.eventType) {
      query = query.where(eq(eventsStandard.eventType, filters.eventType)) as typeof query;
    }
    if (filters?.conversationId) {
      query = query.where(eq(eventsStandard.conversationId, filters.conversationId)) as typeof query;
    }
    
    const events = await query.limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(eventsStandard);
    
    return { events, total: Number(count) };
  },

  async getStandardEventsStats() {
    const byType = await db.select({
      eventType: eventsStandard.eventType,
      count: sql<number>`count(*)`,
    })
      .from(eventsStandard)
      .groupBy(eventsStandard.eventType);

    const bySource = await db.select({
      source: eventsStandard.source,
      count: sql<number>`count(*)`,
    })
      .from(eventsStandard)
      .groupBy(eventsStandard.source);
    
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(eventsStandard);
    
    return {
      total: Number(total),
      byType: Object.fromEntries(byType.map(t => [t.eventType, Number(t.count)])),
      bySource: Object.fromEntries(bySource.map(s => [s.source, Number(s.count)])),
    };
  },

  // Event Type Mapping operations
  async getEventTypeMappings(): Promise<EventTypeMapping[]> {
    return await db.select()
      .from(eventTypeMapping)
      .orderBy(eventTypeMapping.source, eventTypeMapping.eventType);
  },

  async getEventTypeMapping(source: string, eventType: string): Promise<EventTypeMapping | null> {
    const [mapping] = await db.select()
      .from(eventTypeMapping)
      .where(and(
        eq(eventTypeMapping.source, source),
        eq(eventTypeMapping.eventType, eventType)
      ));
    return mapping || null;
  },

  async upsertEventTypeMapping(data: InsertEventTypeMapping): Promise<EventTypeMapping> {
    const [mapping] = await db.insert(eventTypeMapping)
      .values(data)
      .onConflictDoUpdate({
        target: [eventTypeMapping.source, eventTypeMapping.eventType],
        set: {
          displayName: data.displayName,
          description: data.description,
          showInList: data.showInList,
          icon: data.icon,
          updatedAt: new Date(),
        },
      })
      .returning();
    return mapping;
  },

  async updateEventTypeMapping(id: number, data: Partial<InsertEventTypeMapping>): Promise<EventTypeMapping | null> {
    const [updated] = await db.update(eventTypeMapping)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(eventTypeMapping.id, id))
      .returning();
    return updated || null;
  },

  async deleteEventTypeMapping(id: number): Promise<boolean> {
    await db.delete(eventTypeMapping).where(eq(eventTypeMapping.id, id));
    return true;
  },

  async ensureEventTypeMapping(source: string, eventType: string): Promise<void> {
    await db.insert(eventTypeMapping)
      .values({
        source,
        eventType,
        displayName: eventType,
        description: null,
        showInList: true,
        icon: null,
      })
      .onConflictDoNothing({
        target: [eventTypeMapping.source, eventTypeMapping.eventType],
      });
  },

  async getStandardEventsWithMappings(limit = 50, offset = 0, filters?: { source?: string; eventType?: string; showInListOnly?: boolean; conversationId?: number }) {
    const conditions: any[] = [];
    
    if (filters?.showInListOnly) {
      conditions.push(sql`m.show_in_list = true`);
    }
    if (filters?.source) {
      conditions.push(sql`e.source = ${filters.source}`);
    }
    if (filters?.eventType) {
      conditions.push(sql`e.event_type = ${filters.eventType}`);
    }
    if (filters?.conversationId) {
      conditions.push(sql`e.conversation_id = ${filters.conversationId}`);
    }
    
    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;

    const events = await db.execute(sql`
      SELECT 
        e.*,
        m.display_name,
        m.description as type_description,
        m.show_in_list,
        m.icon
      FROM events_standard e
      LEFT JOIN event_type_mapping m ON e.source = m.source AND e.event_type = m.event_type
      ${whereClause}
      ORDER BY e.occurred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM events_standard e
      LEFT JOIN event_type_mapping m ON e.source = m.source AND e.event_type = m.event_type
      ${whereClause}
    `);
    
    return { events: events.rows, total: Number((countResult.rows[0] as any)?.count || 0) };
  },
};
