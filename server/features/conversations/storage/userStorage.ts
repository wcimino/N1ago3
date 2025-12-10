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

    try {
      const [result] = await db.insert(users)
        .values({
          sunshineId,
          externalId: null,
          signedUpAt: userData.signedUpAt || null,
          authenticated: userData.authenticated ?? false,
          profile: userData.profile || null,
          metadata: userData.metadata || null,
          identities: userData.identities || null,
        })
        .onConflictDoUpdate({
          target: users.sunshineId,
          set: {
            signedUpAt: userData.signedUpAt || sql`${users.signedUpAt}`,
            authenticated: userData.authenticated ?? sql`${users.authenticated}`,
            profile: userData.profile || sql`${users.profile}`,
            metadata: userData.metadata || sql`${users.metadata}`,
            identities: userData.identities || sql`${users.identities}`,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      
      return result;
    } catch (error: any) {
      if (error?.cause?.code === '23505') {
        const [existingUser] = await db.select()
          .from(users)
          .where(eq(users.sunshineId, sunshineId));
        return existingUser || null;
      }
      throw error;
    }
  },

  async getHourlyAttendances(timezone: string = 'America/Sao_Paulo') {
    const result = await db.execute(sql`
      WITH tz AS (
        SELECT ${timezone}::text AS name
      ),
      now_local AS (
        SELECT NOW() AT TIME ZONE (SELECT name FROM tz) AS ts
      ),
      current_hour AS (
        SELECT EXTRACT(HOUR FROM (SELECT ts FROM now_local))::int AS hour
      ),
      today_start AS (
        SELECT DATE_TRUNC('day', (SELECT ts FROM now_local)) AS ts
      ),
      last_week_same_day_start AS (
        SELECT (SELECT ts FROM today_start) - INTERVAL '7 days' AS ts
      ),
      last_week_same_day_end AS (
        SELECT (SELECT ts FROM today_start) - INTERVAL '6 days' AS ts
      ),
      hours_series AS (
        SELECT generate_series(0, 23) AS hour
      ),
      today_end AS (
        SELECT (SELECT ts FROM today_start) + INTERVAL '1 day' AS ts
      ),
      today_data AS (
        SELECT 
          EXTRACT(HOUR FROM e.occurred_at AT TIME ZONE (SELECT name FROM tz))::int AS hour,
          COUNT(DISTINCT c.id) AS count
        FROM events_standard e
        INNER JOIN conversations c ON e.conversation_id = c.id
        WHERE (e.occurred_at AT TIME ZONE (SELECT name FROM tz)) >= (SELECT ts FROM today_start)
          AND (e.occurred_at AT TIME ZONE (SELECT name FROM tz)) < (SELECT ts FROM today_end)
        GROUP BY 1
      ),
      last_week_data AS (
        SELECT 
          EXTRACT(HOUR FROM e.occurred_at AT TIME ZONE (SELECT name FROM tz))::int AS hour,
          COUNT(DISTINCT c.id) AS count
        FROM events_standard e
        INNER JOIN conversations c ON e.conversation_id = c.id
        WHERE (e.occurred_at AT TIME ZONE (SELECT name FROM tz)) >= (SELECT ts FROM last_week_same_day_start)
          AND (e.occurred_at AT TIME ZONE (SELECT name FROM tz)) < (SELECT ts FROM last_week_same_day_end)
        GROUP BY 1
      )
      SELECT 
        hs.hour,
        (hs.hour = (SELECT hour FROM current_hour)) AS is_current_hour,
        (hs.hour <= (SELECT hour FROM current_hour)) AS is_past,
        COALESCE(td.count, 0)::int AS today_count,
        COALESCE(lwd.count, 0)::int AS last_week_count
      FROM hours_series hs
      LEFT JOIN today_data td ON hs.hour = td.hour
      LEFT JOIN last_week_data lwd ON hs.hour = lwd.hour
      ORDER BY hs.hour
    `);
    
    return result.rows.map((row: any) => ({
      hour: row.hour,
      isCurrentHour: row.is_current_hour,
      isPast: row.is_past,
      todayCount: Number(row.today_count),
      lastWeekCount: Number(row.last_week_count),
    }));
  },
};
