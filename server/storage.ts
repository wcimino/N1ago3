import { db } from "./db.js";
import { zendeskConversationsWebhookRaw, conversations, messages, users, authUsers, authorizedUsers } from "../shared/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import type { InsertZendeskConversationsWebhookRaw, InsertConversation, InsertMessage, User, UpsertAuthUser, AuthUser, AuthorizedUser, InsertAuthorizedUser } from "../shared/schema.js";

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
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(messages.receivedAt);
    
    return { conversation, messages: msgs };
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
    const [{ totalMessages }] = await db.select({ totalMessages: sql<number>`count(*)` }).from(messages);
    
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
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(messages.receivedAt);
        
        return {
          conversation: conv,
          messages: msgs,
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
};
