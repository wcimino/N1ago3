import { Router } from "express";
import { reportsService } from "../services/reportsService.js";
import { validatePeriod } from "../utils/dateFilter.js";

const router = Router();

function parsePagination(query: any): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 10, 1), 100);
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0);
  return { limit, offset };
}

router.get("/api/reports/product-problem-counts", async (req, res) => {
  try {
    const period = validatePeriod(req.query.period as string);
    const pagination = parsePagination(req.query);
    const results = await reportsService.getProductProblemCounts(period, pagination);
    res.json(results);
  } catch (error) {
    console.error("Error fetching product-problem counts:", error);
    res.status(500).json({ error: "Falha ao gerar relatório" });
  }
});

router.get("/api/reports/customer-conversation-counts", async (req, res) => {
  try {
    const period = validatePeriod(req.query.period as string);
    const pagination = parsePagination(req.query);
    const results = await reportsService.getCustomerConversationCounts(period, pagination);
    res.json(results);
  } catch (error) {
    console.error("Error fetching customer conversation counts:", error);
    res.status(500).json({ error: "Falha ao gerar relatório" });
  }
});

export default router;
