import { db } from "../../../db.js";
import { routingRules, type RoutingRule } from "../../../../shared/schema.js";
import { eq, and, sql, or, asc } from "drizzle-orm";

export async function getAllActiveRules(): Promise<RoutingRule[]> {
  const rules = await db
    .select()
    .from(routingRules)
    .where(
      and(
        eq(routingRules.isActive, true),
        or(
          sql`${routingRules.expiresAt} IS NULL`,
          sql`${routingRules.expiresAt} > NOW()`
        ),
        or(
          sql`${routingRules.allocateCount} IS NULL`,
          sql`${routingRules.allocatedCount} < ${routingRules.allocateCount}`
        )
      )
    )
    .orderBy(asc(routingRules.id));
  
  return rules;
}

export function matchesText(ruleMatchText: string | null, messageText: string): boolean {
  if (!ruleMatchText) {
    return false;
  }
  
  const normalizedRule = ruleMatchText.trim().toLowerCase();
  const normalizedMessage = messageText.trim().toLowerCase();
  
  return normalizedMessage === normalizedRule;
}

export function matchesAuthFilter(rule: RoutingRule, userAuthenticated: boolean | undefined): boolean {
  if (!rule.authFilter || rule.authFilter === "all") {
    return true;
  }
  
  if (userAuthenticated === undefined) {
    return true;
  }
  
  if (rule.authFilter === "authenticated" && userAuthenticated) {
    return true;
  }
  
  if (rule.authFilter === "unauthenticated" && !userAuthenticated) {
    return true;
  }
  
  return false;
}

export async function tryConsumeRuleSlot(ruleId: number): Promise<{ success: boolean; rule: RoutingRule | null; shouldDeactivate: boolean }> {
  const updated = await db
    .update(routingRules)
    .set({
      allocatedCount: sql`${routingRules.allocatedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(routingRules.id, ruleId),
        eq(routingRules.isActive, true),
        sql`${routingRules.allocatedCount} < ${routingRules.allocateCount}`
      )
    )
    .returning();
  
  if (!updated[0]) {
    return { success: false, rule: null, shouldDeactivate: false };
  }
  
  const rule = updated[0];
  const shouldDeactivate = rule.allocateCount !== null && rule.allocatedCount >= rule.allocateCount;
  
  return { success: true, rule, shouldDeactivate };
}

export async function deactivateRule(ruleId: number): Promise<void> {
  await db
    .update(routingRules)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(routingRules.id, ruleId));
}

export async function releaseRuleSlot(ruleId: number): Promise<void> {
  await db
    .update(routingRules)
    .set({
      allocatedCount: sql`GREATEST(${routingRules.allocatedCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(routingRules.id, ruleId));
}

export const routingStorage = {
  getAllActiveRules,
  matchesText,
  matchesAuthFilter,
  tryConsumeRuleSlot,
  deactivateRule,
  releaseRuleSlot,
};
