import { Router } from "express";
import { reportsService } from "../services/reportsService.js";
import { validatePeriod } from "../utils/dateFilter.js";
import { getQuestionTopics, getAvailableProducts, getAvailableSubproducts, type PeriodFilter } from "../services/topicClassificationService.js";

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

router.get("/api/reports/problem-hierarchy", async (req, res) => {
  try {
    const period = validatePeriod(req.query.period as string);
    const results = await reportsService.getHierarchicalProblemData(period);
    res.json(results);
  } catch (error) {
    console.error("Error fetching hierarchical problem data:", error);
    res.status(500).json({ error: "Falha ao gerar relatório" });
  }
});

router.get("/api/reports/question-topics", async (req, res) => {
  try {
    const product = req.query.product as string | undefined;
    const subproduct = req.query.subproduct as string | undefined;
    const periodParam = req.query.period as string | undefined;
    const period: PeriodFilter = (periodParam === "last_hour" || periodParam === "last_24h" || periodParam === "all") 
      ? periodParam 
      : "all";
    const results = await getQuestionTopics(product, subproduct, period);
    res.json(results);
  } catch (error) {
    console.error("Error fetching question topics:", error);
    res.status(500).json({ error: "Falha ao gerar relatório de temas" });
  }
});

router.get("/api/reports/question-topics/products", async (req, res) => {
  try {
    const products = await getAvailableProducts();
    res.json(products);
  } catch (error) {
    console.error("Error fetching available products:", error);
    res.status(500).json({ error: "Falha ao buscar produtos" });
  }
});

router.get("/api/reports/question-topics/subproducts", async (req, res) => {
  try {
    const product = req.query.product as string | undefined;
    const subproducts = await getAvailableSubproducts(product);
    res.json(subproducts);
  } catch (error) {
    console.error("Error fetching available subproducts:", error);
    res.status(500).json({ error: "Falha ao buscar subprodutos" });
  }
});

export default router;
