import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { storage } from "../../../storage.js";
import { generateEnrichmentSuggestions } from "../services/enrichmentAgentAdapter.js";

const router = Router();

router.post("/api/ai/enrichment/generate", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, subproduct } = req.body;

    const config = await storage.getOpenaiApiConfig("enrichment");
    if (!config || !config.enabled) {
      return res.status(400).json({ 
        error: "Enrichment is not enabled. Please configure it in the AI settings." 
      });
    }

    const result = await generateEnrichmentSuggestions({
      product,
      subproduct,
      config
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Enrichment] Error generating suggestions:", error.message);
    res.status(500).json({ error: "Failed to generate enrichment suggestions" });
  }
});

export default router;
