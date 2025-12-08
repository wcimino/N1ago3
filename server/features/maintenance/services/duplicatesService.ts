import { db } from "../../../db.js";
import { eventsStandard } from "../../../../shared/schema.js";
import { sql, eq, and, inArray } from "drizzle-orm";

export interface DuplicateStats {
  totalEvents: number;
  uniqueEvents: number;
  duplicateCount: number;
  duplicateGroups: number;
}

export interface DuplicateGroup {
  source: string;
  sourceEventId: string;
  count: number;
  ids: number[];
  keepId: number;
  deleteIds: number[];
}

export interface CleanupResult {
  deletedCount: number;
  groups: number;
  deletedIds: number[];
}

class DuplicatesService {
  async getStats(): Promise<DuplicateStats> {
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventsStandard);
    
    const duplicateGroupsResult = await db.execute(sql`
      SELECT COUNT(*) as groups FROM (
        SELECT source, source_event_id
        FROM events_standard
        WHERE source_event_id IS NOT NULL
        GROUP BY source, source_event_id
        HAVING COUNT(*) > 1
      ) subquery
    `);
    
    const duplicatesResult = await db.execute(sql`
      WITH duplicates AS (
        SELECT id, source_event_id, ROW_NUMBER() OVER (
          PARTITION BY source, source_event_id 
          ORDER BY id ASC
        ) as rn
        FROM events_standard
        WHERE source_event_id IS NOT NULL
      )
      SELECT COUNT(*) as duplicate_count FROM duplicates WHERE rn > 1
    `);
    
    const totalEvents = Number(totalResult[0]?.count || 0);
    const duplicateCount = Number((duplicatesResult.rows[0] as any)?.duplicate_count || 0);
    const duplicateGroups = Number((duplicateGroupsResult.rows[0] as any)?.groups || 0);
    const uniqueEvents = totalEvents - duplicateCount;
    
    return {
      totalEvents,
      uniqueEvents,
      duplicateCount,
      duplicateGroups,
    };
  }

  async findDuplicates(limit: number = 100): Promise<DuplicateGroup[]> {
    const result = await db.execute(sql`
      WITH duplicate_groups AS (
        SELECT 
          source,
          source_event_id,
          array_agg(id ORDER BY id ASC) as ids,
          COUNT(*) as count
        FROM events_standard
        WHERE source_event_id IS NOT NULL
        GROUP BY source, source_event_id
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT ${limit}
      )
      SELECT * FROM duplicate_groups
    `);
    
    return (result.rows as any[]).map(row => {
      const ids = row.ids as number[];
      return {
        source: row.source,
        sourceEventId: row.source_event_id,
        count: Number(row.count),
        ids,
        keepId: ids[0],
        deleteIds: ids.slice(1),
      };
    });
  }

  async deleteDuplicates(dryRun: boolean = true, batchSize: number = 1000): Promise<CleanupResult> {
    const duplicates = await this.findDuplicates(10000);
    
    const allDeleteIds: number[] = [];
    for (const group of duplicates) {
      allDeleteIds.push(...group.deleteIds);
    }
    
    if (dryRun) {
      return {
        deletedCount: allDeleteIds.length,
        groups: duplicates.length,
        deletedIds: allDeleteIds.slice(0, 100),
      };
    }
    
    let totalDeleted = 0;
    for (let i = 0; i < allDeleteIds.length; i += batchSize) {
      const batch = allDeleteIds.slice(i, i + batchSize);
      await db.delete(eventsStandard).where(inArray(eventsStandard.id, batch));
      totalDeleted += batch.length;
    }
    
    return {
      deletedCount: totalDeleted,
      groups: duplicates.length,
      deletedIds: allDeleteIds.slice(0, 100),
    };
  }
}

export const duplicatesService = new DuplicatesService();
