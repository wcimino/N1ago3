import { db } from "../../../db.js";
import { routingRules, type RoutingRule } from "../../../../shared/schema.js";
import { eq, and, sql, lt, or } from "drizzle-orm";

export async function getActiveRoutingRules(): Promise<RoutingRule[]> {
  const rules = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.isActive, true));
  
  return rules;
}

export async function getActiveAllocateNextNRule(userAuthenticated?: boolean): Promise<RoutingRule | null> {
  const baseConditions = and(
    eq(routingRules.isActive, true),
    eq(routingRules.ruleType, "allocate_next_n")
  );

  let whereCondition;
  if (userAuthenticated === undefined) {
    whereCondition = baseConditions;
  } else {
    const authFilterCondition = or(
      eq(routingRules.authFilter, "all"),
      eq(routingRules.authFilter, userAuthenticated ? "authenticated" : "unauthenticated")
    );
    whereCondition = and(baseConditions, authFilterCondition);
  }

  const rules = await db
    .select()
    .from(routingRules)
    .where(whereCondition)
    .limit(1);
  
  return rules[0] || null;
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

export const routingStorage = {
  getActiveRoutingRules,
  getActiveAllocateNextNRule,
  tryConsumeRuleSlot,
  deactivateRule,
};
