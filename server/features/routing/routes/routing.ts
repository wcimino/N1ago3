import { Router, type Request, type Response } from "express";
import { db } from "../../../db.js";
import { routingRules } from "../../../../shared/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

router.get("/api/routing/rules", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const rules = await db
      .select()
      .from(routingRules)
      .orderBy(desc(routingRules.createdAt));
    res.json(rules);
  } catch (error) {
    console.error("[RoutingRoutes] Error fetching rules:", error);
    res.status(500).json({ error: "Failed to fetch routing rules" });
  }
});

router.get("/api/routing/rules/active", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const rules = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.isActive, true))
      .orderBy(desc(routingRules.createdAt));
    res.json(rules);
  } catch (error) {
    console.error("[RoutingRoutes] Error fetching active rules:", error);
    res.status(500).json({ error: "Failed to fetch active routing rules" });
  }
});

router.post("/api/routing/rules", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { ruleType, target, allocateCount, expiresAt } = req.body;
    const user = (req as any).user;

    if (!ruleType || !target) {
      return res.status(400).json({ error: "ruleType and target are required" });
    }

    if (ruleType === "allocate_next_n" && (!allocateCount || allocateCount < 1)) {
      return res.status(400).json({ error: "allocateCount must be greater than 0" });
    }

    await db
      .update(routingRules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(routingRules.ruleType, ruleType),
        eq(routingRules.isActive, true)
      ));

    const [newRule] = await db
      .insert(routingRules)
      .values({
        ruleType,
        target,
        allocateCount: allocateCount || null,
        isActive: true,
        createdBy: user?.email || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    res.json(newRule);
  } catch (error) {
    console.error("[RoutingRoutes] Error creating rule:", error);
    res.status(500).json({ error: "Failed to create routing rule" });
  }
});

router.patch("/api/routing/rules/:id/deactivate", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [updated] = await db
      .update(routingRules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(routingRules.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("[RoutingRoutes] Error deactivating rule:", error);
    res.status(500).json({ error: "Failed to deactivate routing rule" });
  }
});

router.delete("/api/routing/rules/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [deleted] = await db
      .delete(routingRules)
      .where(eq(routingRules.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[RoutingRoutes] Error deleting rule:", error);
    res.status(500).json({ error: "Failed to delete routing rule" });
  }
});

export default router;
