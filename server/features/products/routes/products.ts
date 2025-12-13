import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

router.get("/api/products/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const [lastHour, last24Hours] = await Promise.all([
      storage.getTopProductsByPeriod("lastHour"),
      storage.getTopProductsByPeriod("last24Hours"),
    ]);

    res.json({
      last_hour: lastHour,
      today: last24Hours,
    });
  } catch (error: any) {
    console.error("[Products Stats] Error:", error.message);
    res.status(500).json({ error: "Failed to fetch product stats" });
  }
});

router.get("/api/emotions/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const [lastHour, last24Hours] = await Promise.all([
      storage.getEmotionStatsByPeriod("lastHour"),
      storage.getEmotionStatsByPeriod("last24Hours"),
    ]);

    res.json({
      last_hour: lastHour,
      today: last24Hours,
    });
  } catch (error: any) {
    console.error("[Emotions Stats] Error:", error.message);
    res.status(500).json({ error: "Failed to fetch emotion stats" });
  }
});

router.get("/api/problems/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const [lastHour, last24Hours] = await Promise.all([
      storage.getObjectiveProblemStatsByPeriod("lastHour"),
      storage.getObjectiveProblemStatsByPeriod("last24Hours"),
    ]);

    res.json({
      last_hour: lastHour,
      today: last24Hours,
    });
  } catch (error: any) {
    console.error("[Problems Stats] Error:", error.message);
    res.status(500).json({ error: "Failed to fetch problem stats" });
  }
});

router.get("/api/product-standards", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const products = await storage.getProductStandards();
    res.json(products);
  } catch (error: any) {
    console.error("[Product Standards] Error fetching:", error.message);
    res.status(500).json({ error: "Failed to fetch product standards" });
  }
});

router.put("/api/product-standards", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, productStandard } = req.body;

    if (!product || typeof product !== "string") {
      return res.status(400).json({ error: "Product is required" });
    }
    if (!productStandard || typeof productStandard !== "string") {
      return res.status(400).json({ error: "Product standard is required" });
    }

    const updatedCount = await storage.updateProductStandard(product, productStandard);
    res.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("[Product Standards] Error updating:", error.message);
    res.status(500).json({ error: "Failed to update product standard" });
  }
});

export default router;
