import { db } from "../../../db.js";
import { usersStandard, usersStandardHistory, users, conversations } from "../../../../shared/schema.js";
import { eq, sql, gte, and } from "drizzle-orm";
import type { UserStandard, InsertUserStandard } from "../../../../shared/schema.js";
import type { StandardUser } from "../../../adapters/types.js";

const TRACKED_FIELDS = ["name", "cpf", "phone", "locale", "externalId", "sourceUserId"] as const;

export const usersStandardStorage = {
  async upsertStandardUser(user: StandardUser): Promise<UserStandard> {
    const existingUser = await db.select()
      .from(usersStandard)
      .where(eq(usersStandard.email, user.email))
      .limit(1);

    if (existingUser.length === 0) {
      const [newUser] = await db.insert(usersStandard)
        .values({
          email: user.email,
          source: user.source,
          sourceUserId: user.sourceUserId || null,
          externalId: user.externalId || null,
          name: user.name || null,
          cpf: user.cpf || null,
          phone: user.phone || null,
          locale: user.locale || null,
          signedUpAt: user.signedUpAt || null,
          metadata: user.metadata || null,
        })
        .returning();
      return newUser;
    }

    const current = existingUser[0];
    const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

    const getValue = (val: string | null | undefined): string | null => {
      if (val === null || val === undefined || val === "") return null;
      return val;
    };

    for (const field of TRACKED_FIELDS) {
      const oldVal = getValue(current[field] as string | null);
      const newVal = getValue(user[field] as string | undefined);
      
      if (newVal !== null && newVal !== oldVal) {
        changes.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }

    if (changes.length > 0) {
      for (const change of changes) {
        await db.insert(usersStandardHistory).values({
          userEmail: user.email,
          fieldName: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          source: user.source,
        });
      }
    }

    const [updatedUser] = await db.update(usersStandard)
      .set({
        source: user.source,
        sourceUserId: sql`COALESCE(NULLIF(${user.sourceUserId || ""}, ''), ${usersStandard.sourceUserId})`,
        externalId: sql`COALESCE(NULLIF(${user.externalId || ""}, ''), ${usersStandard.externalId})`,
        name: sql`COALESCE(NULLIF(${user.name || ""}, ''), ${usersStandard.name})`,
        cpf: sql`COALESCE(NULLIF(${user.cpf || ""}, ''), ${usersStandard.cpf})`,
        phone: sql`COALESCE(NULLIF(${user.phone || ""}, ''), ${usersStandard.phone})`,
        locale: sql`COALESCE(NULLIF(${user.locale || ""}, ''), ${usersStandard.locale})`,
        signedUpAt: user.signedUpAt || current.signedUpAt,
        metadata: user.metadata || current.metadata,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersStandard.email, user.email))
      .returning();

    return updatedUser;
  },

  async getStandardUserByEmail(email: string): Promise<UserStandard | null> {
    const [user] = await db.select()
      .from(usersStandard)
      .where(eq(usersStandard.email, email.toLowerCase()));
    return user || null;
  },

  async getUserHistory(email: string): Promise<Array<{
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    changedAt: Date;
    source: string | null;
  }>> {
    const history = await db.select()
      .from(usersStandardHistory)
      .where(eq(usersStandardHistory.userEmail, email.toLowerCase()))
      .orderBy(usersStandardHistory.changedAt);
    return history;
  },

  async getAllStandardUsers(limit: number = 50, offset: number = 0): Promise<{ users: UserStandard[]; total: number }> {
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(usersStandard);
    const total = Number(countResult.count);

    const users = await db.select()
      .from(usersStandard)
      .orderBy(sql`${usersStandard.lastSeenAt} DESC`)
      .limit(limit)
      .offset(offset);

    return { users, total };
  },

  async getConversationCountsByEmail(emails: string[]): Promise<Map<string, number>> {
    if (emails.length === 0) return new Map();
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await db.execute(sql`
      SELECT 
        us.email,
        COUNT(DISTINCT c.id) as conversation_count
      FROM users_standard us
      LEFT JOIN users u ON u.profile->>'email' = us.email
      LEFT JOIN conversations c ON c.user_id = u.sunshine_id 
        AND c.created_at >= ${sevenDaysAgo}
      WHERE us.email = ANY(${emails})
      GROUP BY us.email
    `);

    const counts = new Map<string, number>();
    for (const row of result.rows as any[]) {
      counts.set(row.email, Number(row.conversation_count) || 0);
    }
    return counts;
  },
};
