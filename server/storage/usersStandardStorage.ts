import { db } from "../db.js";
import { usersStandard, usersStandardHistory } from "../../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import type { UserStandard, InsertUserStandard } from "../../shared/schema.js";
import type { StandardUser } from "../adapters/types.js";

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
};
