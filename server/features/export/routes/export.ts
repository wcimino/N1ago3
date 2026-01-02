import { Router } from "express";
import { requireAuthorizedUser } from "../../../features/auth/index.js";
import { summaryStorage } from "../../ai/storage/summaryStorage.js";
import { classificationStorage } from "../../ai/storage/classificationStorage.js";

const router = Router();

router.get("/api/export/summaries", requireAuthorizedUser, async (req, res) => {
  try {
    const { dateFrom, dateTo, product, productStandard, customerRequestType } = req.query;

    const filters: {
      dateFrom?: Date;
      dateTo?: Date;
      product?: string;
      productStandard?: string;
      customerRequestType?: string;
    } = {};

    if (dateFrom && typeof dateFrom === "string") {
      filters.dateFrom = new Date(dateFrom);
    }
    if (dateTo && typeof dateTo === "string") {
      const date = new Date(dateTo);
      date.setHours(23, 59, 59, 999);
      filters.dateTo = date;
    }
    if (product && typeof product === "string") {
      filters.product = product;
    }
    if (productStandard && typeof productStandard === "string") {
      filters.productStandard = productStandard;
    }
    if (customerRequestType && typeof customerRequestType === "string") {
      filters.customerRequestType = customerRequestType;
    }

    const summaries = await summaryStorage.getSummariesForExport(filters);

    res.json(summaries);
  } catch (error: any) {
    console.error("[Export Route] Error fetching summaries:", error);
    res.status(500).json({ error: "Failed to fetch summaries for export" });
  }
});

router.get("/api/export/filters", requireAuthorizedUser, async (req, res) => {
  try {
    const result = await classificationStorage.getUniqueProductsAndRequestTypes();
    res.json(result);
  } catch (error: any) {
    console.error("[Export Route] Error fetching filters:", error);
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

export default router;
