import { db } from "./db.js";
import { webhookRawLogs, conversations, messages, users, authUsers, authorizedUsers } from "../shared/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import type { InsertWebhookRawLog, InsertConversation, InsertMessage, User, UpsertAuthUser, AuthUser, AuthorizedUser, InsertAuthorizedUser } from "../shared/schema.js";

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

  async getWebhookLogs(limit = 50, offset = 0, status?: string, sunshineId?: string) {
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(webhookRawLogs.processingStatus, status));
    }
    
    if (sunshineId) {
      conditions.push(sql`${webhookRawLogs.payload}::text LIKE ${'%' + sunshineId + '%'}`);
    }
    
    let query = db.select().from(webhookRawLogs).orderBy(desc(webhookRawLogs.receivedAt));
    
    if (conditions.length > 0) {
      for (const condition of conditions) {
        query = query.where(condition) as typeof query;
      }
    }
    
    const logs = await query.limit(limit).offset(offset);
    
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(webhookRawLogs);
    if (conditions.length > 0) {
      for (const condition of conditions) {
        countQuery = countQuery.where(condition) as typeof countQuery;
      }
    }
    const [{ count }] = await countQuery;
    
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
};
