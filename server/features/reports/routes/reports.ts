import { Router } from "express";
import { reportsService } from "../services/reportsService.js";
import { validatePeriod } from "../utils/dateFilter.js";

const router = Router();

router.get("/api/reports/product-problem-counts", async (req, res) => {
  try {
    const period = validatePeriod(req.query.period as string);
    const results = await reportsService.getProductProblemCounts(period);
    res.json(results);
  } catch (error) {
    console.error("Error fetching product-problem counts:", error);
    res.status(500).json({ error: "Falha ao gerar relatório" });
  }
});

router.get("/api/reports/customer-conversation-counts", async (req, res) => {
  try {
    const period = validatePeriod(req.query.period as string);
    const results = await reportsService.getCustomerConversationCounts(period);
    res.json(results);
  } catch (error) {
    console.error("Error fetching customer conversation counts:", error);
    res.status(500).json({ error: "Falha ao gerar relatório" });
  }
});

export default router;
