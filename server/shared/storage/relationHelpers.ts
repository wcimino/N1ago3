import { db } from "../../db.js";
import { eq, and } from "drizzle-orm";

export interface ManyToManyConfig {
  junctionTable: any;
  parentColumn: any;
  childColumn: any;
  parentKey: string;
  childKey: string;
}

export async function syncManyToMany(
  config: ManyToManyConfig,
  parentId: number,
  childIds: number[]
): Promise<void> {
  const { junctionTable, parentColumn, parentKey, childKey } = config;
  
  await db.delete(junctionTable).where(eq(parentColumn, parentId));

  if (childIds.length > 0) {
    const values = childIds.map((childId) => ({
      [parentKey]: parentId,
      [childKey]: childId,
    }));

    await db.insert(junctionTable).values(values as any);
  }
}

export async function getRelatedIds(
  config: ManyToManyConfig,
  parentId: number
): Promise<number[]> {
  const { junctionTable, parentColumn, childColumn } = config;
  
  const results = await db
    .select({ childId: childColumn })
    .from(junctionTable)
    .where(eq(parentColumn, parentId));

  return results.map((r: { childId: number }) => r.childId);
}

export async function addRelation(
  config: ManyToManyConfig,
  parentId: number,
  childId: number,
  extraData?: Record<string, any>
): Promise<void> {
  const { junctionTable, parentKey, childKey } = config;
  
  const values = {
    [parentKey]: parentId,
    [childKey]: childId,
    ...extraData,
  };

  await db.insert(junctionTable).values(values as any);
}

export async function removeRelation(
  config: ManyToManyConfig,
  parentId: number,
  childId: number
): Promise<boolean> {
  const { junctionTable, parentColumn, childColumn } = config;
  
  const result = await db
    .delete(junctionTable)
    .where(and(eq(parentColumn, parentId), eq(childColumn, childId)))
    .returning() as any[];

  return result.length > 0;
}

export async function syncManyToManyWithData<TExtra>(
  config: ManyToManyConfig,
  parentId: number,
  items: Array<{ childId: number; extra: TExtra }>
): Promise<void> {
  const { junctionTable, parentColumn, parentKey, childKey } = config;
  
  await db.delete(junctionTable).where(eq(parentColumn, parentId));

  if (items.length > 0) {
    const values = items.map((item) => ({
      [parentKey]: parentId,
      [childKey]: item.childId,
      ...item.extra,
    }));

    await db.insert(junctionTable).values(values as any);
  }
}
