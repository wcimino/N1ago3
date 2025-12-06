import { db } from "../db.js";
import { authUsers, authorizedUsers } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import type { UpsertAuthUser, AuthUser, AuthorizedUser, InsertAuthorizedUser } from "../../shared/schema.js";

export const authStorage = {
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
    await db.delete(authorizedUsers)
      .where(eq(authorizedUsers.id, id));
    return true;
  },

  async updateLastAccess(email: string): Promise<void> {
    await db.update(authorizedUsers)
      .set({ lastAccess: new Date() })
      .where(eq(authorizedUsers.email, email.toLowerCase()));
  },
};
