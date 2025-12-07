import { Router, type Request, type Response } from "express";
import { storage } from "../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../middleware/auth.js";

const router = Router();

router.get("/api/products/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const [lastHour, last24Hours] = await Promise.all([
      storage.getTopProductsByPeriod("lastHour", 5),
      storage.getTopProductsByPeriod("last24Hours", 5),
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

export default router;
