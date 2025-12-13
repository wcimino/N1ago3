import { Router } from "express";
import { knowledgeSolutionsStorage } from "../storage/knowledgeSolutionsStorage.js";
import type { InsertKnowledgeBaseSolution } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/solutions", async (req, res) => {
  try {
    const { search, productId, isActive } = req.query;
    
    const solutions = await knowledgeSolutionsStorage.getAll({
      search: search as string | undefined,
      productId: productId ? parseInt(productId as string) : undefined,
      isActive: isActive === undefined ? undefined : isActive === "true",
    });
    res.json(solutions);
  } catch (error) {
    console.error("Error fetching knowledge solutions:", error);
    res.status(500).json({ error: "Failed to fetch solutions" });
  }
});

router.get("/api/knowledge/solutions/filters", async (req, res) => {
  try {
    const productIds = await knowledgeSolutionsStorage.getUniqueProductIds();
    res.json({ productIds });
  } catch (error) {
    console.error("Error fetching solution filters:", error);
    res.status(500).json({ error: "Failed to fetch filters" });
  }
});

router.get("/api/knowledge/solutions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { withActions } = req.query;
    
    if (withActions === "true") {
      const solution = await knowledgeSolutionsStorage.getByIdWithActions(id);
      if (!solution) {
        return res.status(404).json({ error: "Solution not found" });
      }
      return res.json(solution);
    }
    
    const solution = await knowledgeSolutionsStorage.getById(id);
    if (!solution) {
      return res.status(404).json({ error: "Solution not found" });
    }
    res.json(solution);
  } catch (error) {
    console.error("Error fetching solution:", error);
    res.status(500).json({ error: "Failed to fetch solution" });
  }
});

router.post("/api/knowledge/solutions", async (req, res) => {
  try {
    const data: InsertKnowledgeBaseSolution = req.body;
    
    if (!data.name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }
    
    const solution = await knowledgeSolutionsStorage.create(data);
    res.status(201).json(solution);
  } catch (error) {
    console.error("Error creating solution:", error);
    res.status(500).json({ error: "Failed to create solution" });
  }
});

router.put("/api/knowledge/solutions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const data: Partial<InsertKnowledgeBaseSolution> = req.body;
    const solution = await knowledgeSolutionsStorage.update(id, data);
    
    if (!solution) {
      return res.status(404).json({ error: "Solution not found" });
    }
    
    res.json(solution);
  } catch (error) {
    console.error("Error updating solution:", error);
    res.status(500).json({ error: "Failed to update solution" });
  }
});

router.delete("/api/knowledge/solutions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const deleted = await knowledgeSolutionsStorage.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Solution not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting solution:", error);
    res.status(500).json({ error: "Failed to delete solution" });
  }
});

router.post("/api/knowledge/solutions/:id/actions", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid solution ID" });
    }
    
    const { actionId, actionSequence } = req.body;
    
    if (!actionId || actionSequence === undefined) {
      return res.status(400).json({ error: "Missing required fields: actionId and actionSequence" });
    }
    
    await knowledgeSolutionsStorage.addAction(id, actionId, actionSequence);
    const solution = await knowledgeSolutionsStorage.getByIdWithActions(id);
    res.json(solution);
  } catch (error) {
    console.error("Error adding action to solution:", error);
    res.status(500).json({ error: "Failed to add action" });
  }
});

router.delete("/api/knowledge/solutions/:id/actions/:actionId", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actionId = parseInt(req.params.actionId);
    
    if (isNaN(id) || isNaN(actionId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const removed = await knowledgeSolutionsStorage.removeAction(id, actionId);
    if (!removed) {
      return res.status(404).json({ error: "Action association not found" });
    }
    
    const solution = await knowledgeSolutionsStorage.getByIdWithActions(id);
    res.json(solution);
  } catch (error) {
    console.error("Error removing action from solution:", error);
    res.status(500).json({ error: "Failed to remove action" });
  }
});

router.put("/api/knowledge/solutions/:id/actions/reorder", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid solution ID" });
    }
    
    const { actionIds } = req.body;
    
    if (!Array.isArray(actionIds)) {
      return res.status(400).json({ error: "actionIds must be an array" });
    }
    
    await knowledgeSolutionsStorage.reorderActions(id, actionIds);
    const solution = await knowledgeSolutionsStorage.getByIdWithActions(id);
    res.json(solution);
  } catch (error) {
    console.error("Error reordering actions:", error);
    res.status(500).json({ error: "Failed to reorder actions" });
  }
});

export default router;
