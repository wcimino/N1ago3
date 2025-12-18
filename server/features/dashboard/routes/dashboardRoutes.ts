import { Router } from "express";
import { dashboardAnalyticsStorage, type DashboardAnalyticsParams } from "../storage/dashboardAnalyticsStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

router.get("/analytics", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const period = (req.query.period as string) === "lastHour" ? "lastHour" : "last24Hours";
    const timezone = (req.query.timezone as string) || "America/Sao_Paulo";
    
    const params: DashboardAnalyticsParams = { period, timezone };
    const analytics = await dashboardAnalyticsStorage.getDashboardAnalytics(params);
    
    res.json(analytics);
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard analytics" });
  }
});

export default router;
