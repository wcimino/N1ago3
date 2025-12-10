import { db } from "../../../db.js";
import { users, conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, desc, sql, gte } from "drizzle-orm";
import type { User } from "../../../../shared/schema.js";
import type { ExtractedUser } from "../../../adapters/types.js";

export const userStorage = {
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

  async getUsers(limit = 50, offset = 0) {
    const usersList = await db.select().from(users)
      .orderBy(desc(users.lastSeenAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    
    return { users: usersList, total: Number(count) };
  },

  async getUsersStats() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Count distinct conversations (atendimentos) that had activity in the last 24h
    // This matches the same logic used in emotions/products stats for consistency
    const result = await db
      .select({
        total: sql<number>`count(DISTINCT ${conversations.id})::int`,
        authenticated: sql<number>`count(DISTINCT ${conversations.id}) FILTER (WHERE ${users.authenticated} = true)::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .leftJoin(users, eq(conversations.userId, users.sunshineId))
      .where(gte(eventsStandard.occurredAt, twentyFourHoursAgo));
    
    const total = result[0]?.total || 0;
    const authenticated = result[0]?.authenticated || 0;
    
    return {
      total: Number(total),
      authenticated: Number(authenticated),
      anonymous: Number(total) - Number(authenticated),
    };
  },

  async getUserBySunshineId(sunshineId: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.sunshineId, sunshineId));
    return user || null;
  },

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
};
