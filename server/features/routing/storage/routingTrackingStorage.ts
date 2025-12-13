import { db } from "../../../db.js";
import { routingProcessedEvents } from "../../../../shared/schema.js";
import { eq, and, lt, sql } from "drizzle-orm";

const DEFAULT_TTL_HOURS = 24;

export async function hasProcessedConversation(
  externalConversationId: string,
  ruleType: string
): Promise<boolean> {
  const existing = await db
    .select({ id: routingProcessedEvents.id })
    .from(routingProcessedEvents)
    .where(
      and(
        eq(routingProcessedEvents.externalConversationId, externalConversationId),
        eq(routingProcessedEvents.ruleType, ruleType),
        sql`${routingProcessedEvents.expiresAt} > NOW()`
      )
    )
    .limit(1);

  return existing.length > 0;
}

export async function markConversationProcessed(
  externalConversationId: string,
  ruleId: number,
  ruleType: string,
  ttlHours: number = DEFAULT_TTL_HOURS
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  await db
    .insert(routingProcessedEvents)
    .values({
      externalConversationId,
      ruleId,
      ruleType,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [routingProcessedEvents.externalConversationId, routingProcessedEvents.ruleType],
      set: {
        ruleId,
        processedAt: new Date(),
        expiresAt,
      },
    });
}

export async function pruneExpiredTracking(): Promise<number> {
  const deleted = await db
    .delete(routingProcessedEvents)
    .where(lt(routingProcessedEvents.expiresAt, new Date()))
    .returning({ id: routingProcessedEvents.id });

  return deleted.length;
}

export async function removeConversationTracking(
  externalConversationId: string,
  ruleType: string
): Promise<void> {
  await db
    .delete(routingProcessedEvents)
    .where(
      and(
        eq(routingProcessedEvents.externalConversationId, externalConversationId),
        eq(routingProcessedEvents.ruleType, ruleType)
      )
    );
}

export const routingTrackingStorage = {
  hasProcessedConversation,
  markConversationProcessed,
  pruneExpiredTracking,
  removeConversationTracking,
};
