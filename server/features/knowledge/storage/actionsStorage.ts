import { db } from "../../../db.js";
import { 
  knowledgeBaseActions, 
  type KnowledgeBaseAction, 
  type InsertKnowledgeBaseAction 
} from "../../../../shared/schema.js";
import { eq, desc, sql } from "drizzle-orm";

export async function getAllActions(): Promise<KnowledgeBaseAction[]> {
  return db
    .select()
    .from(knowledgeBaseActions)
    .orderBy(desc(knowledgeBaseActions.createdAt));
}

export async function getActiveActions(): Promise<KnowledgeBaseAction[]> {
  return db
    .select()
    .from(knowledgeBaseActions)
    .where(eq(knowledgeBaseActions.isActive, true))
    .orderBy(desc(knowledgeBaseActions.createdAt));
}

export async function getActionById(id: number): Promise<KnowledgeBaseAction | undefined> {
  const results = await db
    .select()
    .from(knowledgeBaseActions)
    .where(eq(knowledgeBaseActions.id, id));
  
  return results[0];
}

export async function createAction(data: InsertKnowledgeBaseAction): Promise<KnowledgeBaseAction> {
  const results = await db
    .insert(knowledgeBaseActions)
    .values(data)
    .returning();
  
  return results[0];
}

export async function updateAction(
  id: number, 
  data: Partial<InsertKnowledgeBaseAction>
): Promise<KnowledgeBaseAction | undefined> {
  const results = await db
    .update(knowledgeBaseActions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(knowledgeBaseActions.id, id))
    .returning();
  
  return results[0];
}

export async function deleteAction(id: number): Promise<boolean> {
  const result = await db
    .delete(knowledgeBaseActions)
    .where(eq(knowledgeBaseActions.id, id))
    .returning();
  return result.length > 0;
}

export async function getActionStats(): Promise<{ total: number; active: number; inactive: number }> {
  const results = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`sum(case when is_active then 1 else 0 end)::int`,
      inactive: sql<number>`sum(case when not is_active then 1 else 0 end)::int`,
    })
    .from(knowledgeBaseActions);
  
  return results[0] || { total: 0, active: 0, inactive: 0 };
}
