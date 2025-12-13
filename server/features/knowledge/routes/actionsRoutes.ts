import { Router } from "express";
import {
  getAllActions,
  getActionById,
  createAction,
  updateAction,
  deleteAction,
  getActionStats,
} from "../storage/actionsStorage.js";

const router = Router();

router.get("/api/knowledge/actions/stats", async (_req, res) => {
  try {
    const stats = await getActionStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching actions stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/api/knowledge/actions", async (_req, res) => {
  try {
    const actions = await getAllActions();
    res.json(actions);
  } catch (error) {
    console.error("Error fetching actions:", error);
    res.status(500).json({ error: "Failed to fetch actions" });
  }
});

router.get("/api/knowledge/actions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const action = await getActionById(id);
    if (!action) {
      return res.status(404).json({ error: "Action not found" });
    }
    res.json(action);
  } catch (error) {
    console.error("Error fetching action:", error);
    res.status(500).json({ error: "Failed to fetch action" });
  }
});

router.post("/api/knowledge/actions", async (req, res) => {
  try {
    const { actionType, description, requiredInput, messageTemplate, ownerTeam, sla, isActive } = req.body;
    
    if (!actionType || !description) {
      return res.status(400).json({ error: "actionType and description are required" });
    }
    
    const action = await createAction({
      actionType,
      description,
      requiredInput: requiredInput || null,
      messageTemplate: messageTemplate || null,
      ownerTeam: ownerTeam || null,
      sla: sla || null,
      isActive: isActive !== undefined ? isActive : true,
    });
    
    res.status(201).json(action);
  } catch (error) {
    console.error("Error creating action:", error);
    res.status(500).json({ error: "Failed to create action" });
  }
});

router.put("/api/knowledge/actions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { actionType, description, requiredInput, messageTemplate, ownerTeam, sla, isActive } = req.body;
    
    const action = await updateAction(id, {
      actionType,
      description,
      requiredInput,
      messageTemplate,
      ownerTeam,
      sla,
      isActive,
    });
    
    if (!action) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    res.json(action);
  } catch (error) {
    console.error("Error updating action:", error);
    res.status(500).json({ error: "Failed to update action" });
  }
});

router.delete("/api/knowledge/actions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await deleteAction(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting action:", error);
    res.status(500).json({ error: "Failed to delete action" });
  }
});

export default router;
