import { db } from "../../../db.js";
import { usersStandard, usersStandardHistory, users, conversations } from "../../../../shared/schema.js";
import { eq, sql, gte, and } from "drizzle-orm";
import type { UserStandard, InsertUserStandard } from "../../../../shared/schema.js";
import type { StandardUser } from "../../events/adapters/types.js";

const TRACKED_FIELDS = ["name", "cpf", "phone", "locale", "externalId", "sourceUserId"] as const;

const sanitizeString = (val: string | null | undefined): string | null => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
};

export const usersStandardStorage = {
  async upsertStandardUser(user: StandardUser): Promise<UserStandard> {
    const sanitizedEmail = sanitizeString(user.email);
    if (!sanitizedEmail) {
      throw new Error("Cannot upsert user without valid email");
    }
    
    const sanitizedData = {
      email: sanitizedEmail.toLowerCase(),
      source: user.source,
      sourceUserId: sanitizeString(user.sourceUserId),
      externalId: sanitizeString(user.externalId),
      name: sanitizeString(user.name),
      cpf: sanitizeString(user.cpf),
      phone: sanitizeString(user.phone),
      locale: sanitizeString(user.locale),
      signedUpAt: user.signedUpAt || null,
      metadata: user.metadata || null,
    };

    const existingUser = await db.select()
      .from(usersStandard)
      .where(eq(usersStandard.email, sanitizedData.email))
      .limit(1);

    const previousState = existingUser.length > 0 ? existingUser[0] : null;

    const [result] = await db.insert(usersStandard)
      .values(sanitizedData)
      .onConflictDoUpdate({
        target: usersStandard.email,
        set: {
          source: sanitizedData.source,
          sourceUserId: sanitizedData.sourceUserId !== null 
            ? sanitizedData.sourceUserId 
            : sql`${usersStandard.sourceUserId}`,
          externalId: sanitizedData.externalId !== null 
            ? sanitizedData.externalId 
            : sql`${usersStandard.externalId}`,
          name: sanitizedData.name !== null 
            ? sanitizedData.name 
            : sql`${usersStandard.name}`,
          cpf: sanitizedData.cpf !== null 
            ? sanitizedData.cpf 
            : sql`${usersStandard.cpf}`,
          phone: sanitizedData.phone !== null 
            ? sanitizedData.phone 
            : sql`${usersStandard.phone}`,
          locale: sanitizedData.locale !== null 
            ? sanitizedData.locale 
            : sql`${usersStandard.locale}`,
          signedUpAt: sanitizedData.signedUpAt !== null 
            ? sanitizedData.signedUpAt 
            : sql`${usersStandard.signedUpAt}`,
          metadata: sanitizedData.metadata !== null 
            ? sanitizedData.metadata 
            : sql`${usersStandard.metadata}`,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (previousState) {
      const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

      for (const field of TRACKED_FIELDS) {
        const oldVal = previousState[field] as string | null;
        const newVal = sanitizedData[field as keyof typeof sanitizedData] as string | null;
        
        if (newVal !== null && newVal !== oldVal) {
          changes.push({ field, oldValue: oldVal, newValue: newVal });
        }
      }

      if (changes.length > 0) {
        for (const change of changes) {
          await db.insert(usersStandardHistory).values({
            userEmail: sanitizedData.email,
            fieldName: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            source: sanitizedData.source,
          });
        }
      }
    }

    return result;
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
