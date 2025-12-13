import { Router } from "express";
import { rootCausesStorage, type ProblemWithQuestions } from "../storage/rootCausesStorage.js";
import type { InsertKnowledgeBaseRootCause } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/root-causes", async (req, res) => {
  try {
    const { search, isActive } = req.query;
    
    const rootCauses = await rootCausesStorage.getAll({
      search: search as string | undefined,
      isActive: isActive === undefined ? undefined : isActive === "true",
    });
    res.json(rootCauses);
  } catch (error) {
    console.error("Error fetching root causes:", error);
    res.status(500).json({ error: "Failed to fetch root causes" });
  }
});

router.get("/api/knowledge/root-causes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { withRelations } = req.query;
    
    if (withRelations === "true") {
      const rootCause = await rootCausesStorage.getByIdWithRelations(id);
      if (!rootCause) {
        return res.status(404).json({ error: "Root cause not found" });
      }
      return res.json(rootCause);
    }
    
    const rootCause = await rootCausesStorage.getById(id);
    if (!rootCause) {
      return res.status(404).json({ error: "Root cause not found" });
    }
    res.json(rootCause);
  } catch (error) {
    console.error("Error fetching root cause:", error);
    res.status(500).json({ error: "Failed to fetch root cause" });
  }
});

router.post("/api/knowledge/root-causes", async (req, res) => {
  try {
    const { problems, solutionIds, ...data }: InsertKnowledgeBaseRootCause & { 
      problems?: ProblemWithQuestions[];
      solutionIds?: number[];
    } = req.body;
    
    if (!data.name || !data.description) {
      return res.status(400).json({ error: "Missing required fields: name and description" });
    }
    
    const rootCause = await rootCausesStorage.create(data);
    
    if (problems && problems.length > 0) {
      await rootCausesStorage.setProblemsWithQuestions(rootCause.id, problems);
    }
    
    if (solutionIds && solutionIds.length > 0) {
      await rootCausesStorage.setSolutions(rootCause.id, solutionIds);
    }
    
    const result = await rootCausesStorage.getByIdWithRelations(rootCause.id);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating root cause:", error);
    res.status(500).json({ error: "Failed to create root cause" });
  }
});

router.put("/api/knowledge/root-causes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { problems, solutionIds, ...data }: Partial<InsertKnowledgeBaseRootCause> & { 
      problems?: ProblemWithQuestions[];
      solutionIds?: number[];
    } = req.body;
    
    const rootCause = await rootCausesStorage.update(id, data);
    
    if (!rootCause) {
      return res.status(404).json({ error: "Root cause not found" });
    }
    
    if (problems !== undefined) {
      await rootCausesStorage.setProblemsWithQuestions(id, problems);
    }
    
    if (solutionIds !== undefined) {
      await rootCausesStorage.setSolutions(id, solutionIds);
    }
    
    const result = await rootCausesStorage.getByIdWithRelations(id);
    res.json(result);
  } catch (error) {
    console.error("Error updating root cause:", error);
    res.status(500).json({ error: "Failed to update root cause" });
  }
});

router.delete("/api/knowledge/root-causes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const deleted = await rootCausesStorage.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Root cause not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting root cause:", error);
    res.status(500).json({ error: "Failed to delete root cause" });
  }
});

export default router;
