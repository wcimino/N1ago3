import { db } from "../db.js";
import { eventsStandard, eventTypeMappings } from "../../shared/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import type { InsertEventStandard, EventStandard, EventTypeMapping, InsertEventTypeMapping } from "../../shared/schema.js";
import type { StandardEvent } from "../adapters/types.js";

export const eventStorage = {
  async saveStandardEvent(event: StandardEvent & { sourceRawId?: number; conversationId?: number; userId?: number }): Promise<EventStandard> {
    const [saved] = await db.insert(eventsStandard).values({
      eventType: event.eventType,
      eventSubtype: event.eventSubtype,
      source: event.source,
      sourceEventId: event.sourceEventId,
      sourceRawId: event.sourceRawId,
      conversationId: event.conversationId,
      externalConversationId: event.externalConversationId,
      userId: event.userId,
      externalUserId: event.externalUserId,
      authorType: event.authorType,
      authorId: event.authorId,
      authorName: event.authorName,
      contentText: event.contentText,
      contentPayload: event.contentPayload,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      channelType: event.channelType,
      processingStatus: "processed",
    }).returning();
    
    await this.ensureEventTypeMapping(event.source, event.eventType);
    
    return saved;
  },

  async getStandardEvents(limit = 50, offset = 0, filters?: { source?: string; eventType?: string; conversationId?: number }) {
    const conditions: any[] = [];
    
    if (filters?.source) {
      conditions.push(eq(eventsStandard.source, filters.source));
    }
    if (filters?.eventType) {
      conditions.push(eq(eventsStandard.eventType, filters.eventType));
    }
    if (filters?.conversationId) {
      conditions.push(eq(eventsStandard.conversationId, filters.conversationId));
    }
    
    let query = db.select().from(eventsStandard).orderBy(desc(eventsStandard.occurredAt));
    for (const condition of conditions) {
      query = query.where(condition) as typeof query;
    }
    
    const events = await query.limit(limit).offset(offset);
    
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(eventsStandard);
    for (const condition of conditions) {
      countQuery = countQuery.where(condition) as typeof countQuery;
    }
    const [{ count }] = await countQuery;
    
    return { events, total: Number(count) };
  },

  async getStandardEventsStats() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const byType = await db.select({
      eventType: eventsStandard.eventType,
      count: sql<number>`count(*)`,
    })
      .from(eventsStandard)
      .where(sql`${eventsStandard.occurredAt} >= ${last24h}`)
      .groupBy(eventsStandard.eventType);
    
    const [{ total }] = await db.select({ total: sql<number>`count(*)` })
      .from(eventsStandard)
      .where(sql`${eventsStandard.occurredAt} >= ${last24h}`);
    
    return {
      total: Number(total),
      byType: Object.fromEntries(byType.map(t => [t.eventType, Number(t.count)])),
    };
  },

  async getEventTypeMappings(): Promise<EventTypeMapping[]> {
    return await db.select()
      .from(eventTypeMappings)
      .orderBy(eventTypeMappings.source, eventTypeMappings.eventType);
  },

  async getEventTypeMapping(source: string, eventType: string): Promise<EventTypeMapping | null> {
    const [mapping] = await db.select()
      .from(eventTypeMappings)
      .where(and(
        eq(eventTypeMappings.source, source),
        eq(eventTypeMappings.eventType, eventType)
      ));
    return mapping || null;
  },

  async upsertEventTypeMapping(data: InsertEventTypeMapping): Promise<EventTypeMapping> {
    const [mapping] = await db.insert(eventTypeMappings)
      .values(data)
      .onConflictDoUpdate({
        target: [eventTypeMappings.source, eventTypeMappings.eventType],
        set: {
          displayName: data.displayName,
          description: data.description,
          showInList: data.showInList,
          icon: data.icon,
          updatedAt: new Date(),
        },
      })
      .returning();
    return mapping;
  },

  async updateEventTypeMapping(id: number, data: Partial<InsertEventTypeMapping>): Promise<EventTypeMapping | null> {
    const [updated] = await db.update(eventTypeMappings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(eventTypeMappings.id, id))
      .returning();
    return updated || null;
  },

  async deleteEventTypeMapping(id: number): Promise<boolean> {
    await db.delete(eventTypeMappings)
      .where(eq(eventTypeMappings.id, id));
    return true;
  },

  async ensureEventTypeMapping(source: string, eventType: string): Promise<void> {
    await db.insert(eventTypeMappings)
      .values({
        source,
        eventType,
        displayName: eventType,
        description: null,
        showInList: true,
        icon: null,
      })
      .onConflictDoNothing({
        target: [eventTypeMappings.source, eventTypeMappings.eventType],
      });
  },

  async getStandardEventsWithMappings(limit = 50, offset = 0, filters?: { source?: string; eventType?: string; showInListOnly?: boolean; conversationId?: number }) {
    const conditions: any[] = [];
    
    if (filters?.showInListOnly) {
      conditions.push(sql`m.show_in_list = true`);
    }
    if (filters?.source) {
      conditions.push(sql`e.source = ${filters.source}`);
    }
    if (filters?.eventType) {
      conditions.push(sql`e.event_type = ${filters.eventType}`);
    }
    if (filters?.conversationId) {
      conditions.push(sql`e.conversation_id = ${filters.conversationId}`);
    }
    
    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;

    const events = await db.execute(sql`
      SELECT 
        e.*,
        m.display_name,
        m.description as type_description,
        m.show_in_list,
        m.icon
      FROM events_standard e
      LEFT JOIN event_type_mappings m ON e.source = m.source AND e.event_type = m.event_type
      ${whereClause}
      ORDER BY e.occurred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM events_standard e
      LEFT JOIN event_type_mappings m ON e.source = m.source AND e.event_type = m.event_type
      ${whereClause}
    `);
    
    return { events: events.rows, total: Number((countResult.rows[0] as any)?.count || 0) };
  },

  async getLast20MessagesForConversation(conversationId: number): Promise<EventStandard[]> {
    return await db.select()
      .from(eventsStandard)
      .where(and(
        eq(eventsStandard.conversationId, conversationId),
        eq(eventsStandard.eventType, 'message')
      ))
      .orderBy(desc(eventsStandard.occurredAt))
      .limit(20);
  },
};
