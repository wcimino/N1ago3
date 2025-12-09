import { Router } from "express";
import { knowledgeSuggestionsStorage, type SuggestionStatus } from "../storage/knowledgeSuggestionsStorage.js";
import type { InsertKnowledgeSuggestion } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/suggestions", async (req, res) => {
  try {
    const { status, productStandard, limit, offset } = req.query;
    const suggestions = await knowledgeSuggestionsStorage.getAllSuggestions({
      status: status as SuggestionStatus | undefined,
      productStandard: productStandard as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(suggestions);
  } catch (error) {
    console.error("Error fetching knowledge suggestions:", error);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

router.get("/api/knowledge/suggestions/stats", async (req, res) => {
  try {
    const counts = await knowledgeSuggestionsStorage.getStatusCounts();
    res.json(counts);
  } catch (error) {
    console.error("Error fetching suggestion stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/api/knowledge/suggestions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const suggestion = await knowledgeSuggestionsStorage.getSuggestionById(id);
    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }
    res.json(suggestion);
  } catch (error) {
    console.error("Error fetching suggestion:", error);
    res.status(500).json({ error: "Failed to fetch suggestion" });
  }
});

router.post("/api/knowledge/suggestions", async (req, res) => {
  try {
    const data: InsertKnowledgeSuggestion = req.body;
    const suggestion = await knowledgeSuggestionsStorage.createSuggestion(data);
    res.status(201).json(suggestion);
  } catch (error) {
    console.error("Error creating suggestion:", error);
    res.status(500).json({ error: "Failed to create suggestion" });
  }
});

router.put("/api/knowledge/suggestions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const data: Partial<InsertKnowledgeSuggestion> = req.body;
    const suggestion = await knowledgeSuggestionsStorage.updateSuggestion(id, data);
    
    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }
    
    res.json(suggestion);
  } catch (error) {
    console.error("Error updating suggestion:", error);
    res.status(500).json({ error: "Failed to update suggestion" });
  }
});

router.post("/api/knowledge/suggestions/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const reviewedBy = (req as any).user?.id || "system";
    const suggestion = await knowledgeSuggestionsStorage.approveSuggestion(id, reviewedBy);
    
    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }
    
    res.json(suggestion);
  } catch (error) {
    console.error("Error approving suggestion:", error);
    res.status(500).json({ error: "Failed to approve suggestion" });
  }
});

router.post("/api/knowledge/suggestions/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { reason } = req.body;
    const reviewedBy = (req as any).user?.id || "system";
    const suggestion = await knowledgeSuggestionsStorage.rejectSuggestion(id, reviewedBy, reason);
    
    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }
    
    res.json(suggestion);
  } catch (error) {
    console.error("Error rejecting suggestion:", error);
    res.status(500).json({ error: "Failed to reject suggestion" });
  }
});

router.post("/api/knowledge/suggestions/:id/merge", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { targetArticleId } = req.body;
    if (!targetArticleId || isNaN(parseInt(targetArticleId))) {
      return res.status(400).json({ error: "Target article ID is required" });
    }

    const reviewedBy = (req as any).user?.id || "system";
    const suggestion = await knowledgeSuggestionsStorage.mergeSuggestion(
      id, 
      parseInt(targetArticleId), 
      reviewedBy
    );
    
    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }
    
    res.json(suggestion);
  } catch (error) {
    console.error("Error merging suggestion:", error);
    res.status(500).json({ error: "Failed to merge suggestion" });
  }
});

export default router;
