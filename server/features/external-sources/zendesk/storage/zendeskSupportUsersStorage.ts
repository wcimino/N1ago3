import { db } from "../../../../db.js";
import { zendeskSupportUsers, externalDataSyncLogs, type ZendeskSupportUser, type InsertZendeskSupportUser, type ExternalDataSyncLog, type InsertExternalDataSyncLog } from "../../../../../shared/schema.js";
import { eq, ilike, or, desc, and, sql, type SQL, count } from "drizzle-orm";

export interface ZendeskUserFilters {
  search?: string;
  role?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface ZendeskUserListResult {
  users: ZendeskSupportUser[];
  total: number;
  limit: number;
  offset: number;
}

export async function listZendeskUsers(filters: ZendeskUserFilters = {}): Promise<ZendeskUserListResult> {
  const { search, role, active, limit = 50, offset = 0 } = filters;
  
  const conditions: SQL[] = [];
  
  if (search) {
    conditions.push(
      or(
        ilike(zendeskSupportUsers.name, `%${search}%`),
        ilike(zendeskSupportUsers.email, `%${search}%`)
      )!
    );
  }
  
  if (role) {
    conditions.push(eq(zendeskSupportUsers.role, role));
  }
  
  if (active !== undefined) {
    conditions.push(eq(zendeskSupportUsers.active, active));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [users, totalResult] = await Promise.all([
    db
      .select()
      .from(zendeskSupportUsers)
      .where(whereClause)
      .orderBy(desc(zendeskSupportUsers.zendeskUpdatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(zendeskSupportUsers)
      .where(whereClause)
  ]);
  
  return {
    users,
    total: totalResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function getZendeskUserByZendeskId(zendeskId: number): Promise<ZendeskSupportUser | null> {
  const result = await db
    .select()
    .from(zendeskSupportUsers)
    .where(eq(zendeskSupportUsers.zendeskId, zendeskId))
    .limit(1);
  
  return result[0] ?? null;
}

export async function upsertZendeskUser(data: InsertZendeskSupportUser): Promise<ZendeskSupportUser> {
  const result = await db
    .insert(zendeskSupportUsers)
    .values(data)
    .onConflictDoUpdate({
      target: zendeskSupportUsers.zendeskId,
      set: {
        ...data,
        updatedAt: new Date(),
      },
    })
    .returning();
  
  return result[0];
}

export async function upsertZendeskUsersBatch(users: InsertZendeskSupportUser[]): Promise<{ created: number; updated: number }> {
  if (users.length === 0) {
    return { created: 0, updated: 0 };
  }
  
  const existingIds = new Set(
    (await db
      .select({ zendeskId: zendeskSupportUsers.zendeskId })
      .from(zendeskSupportUsers)
      .where(sql`${zendeskSupportUsers.zendeskId} IN (${sql.join(users.map(u => sql`${u.zendeskId}`), sql`, `)})`)
    ).map(r => r.zendeskId)
  );
  
  const toCreate = users.filter(u => !existingIds.has(u.zendeskId));
  const toUpdate = users.filter(u => existingIds.has(u.zendeskId));
  
  if (toCreate.length > 0) {
    await db.insert(zendeskSupportUsers).values(toCreate);
  }
  
  for (const user of toUpdate) {
    await db
      .update(zendeskSupportUsers)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(zendeskSupportUsers.zendeskId, user.zendeskId));
  }
  
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function getZendeskUsersCount(): Promise<number> {
  const result = await db.select({ count: count() }).from(zendeskSupportUsers);
  return result[0]?.count ?? 0;
}

export async function createSyncLog(data: InsertExternalDataSyncLog): Promise<ExternalDataSyncLog> {
  const result = await db
    .insert(externalDataSyncLogs)
    .values(data)
    .returning();
  
  return result[0];
}

export async function updateSyncLog(
  id: number,
  data: Partial<ExternalDataSyncLog>
): Promise<ExternalDataSyncLog | null> {
  const result = await db
    .update(externalDataSyncLogs)
    .set(data)
    .where(eq(externalDataSyncLogs.id, id))
    .returning();
  
  return result[0] ?? null;
}

export async function getLatestSyncLog(sourceType: string): Promise<ExternalDataSyncLog | null> {
  const result = await db
    .select()
    .from(externalDataSyncLogs)
    .where(eq(externalDataSyncLogs.sourceType, sourceType))
    .orderBy(desc(externalDataSyncLogs.startedAt))
    .limit(1);
  
  return result[0] ?? null;
}

export async function getSyncLogs(
  sourceType: string,
  limit: number = 10
): Promise<ExternalDataSyncLog[]> {
  return db
    .select()
    .from(externalDataSyncLogs)
    .where(eq(externalDataSyncLogs.sourceType, sourceType))
    .orderBy(desc(externalDataSyncLogs.startedAt))
    .limit(limit);
}
