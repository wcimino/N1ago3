import { Router } from "express";
import { syncZendeskUsers, getSyncStatus, listZendeskUsers } from "../services/zendeskSupportUsersService.js";

const router = Router();

router.post("/sync", async (req, res) => {
  try {
    const result = await syncZendeskUsers();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("[ZendeskSupportUsers] Sync error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Erro interno do servidor",
    });
  }
});

router.get("/sync-status", async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error("[ZendeskSupportUsers] Get sync status error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno do servidor",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { search, role, active, limit, offset } = req.query;
    
    const filters = {
      search: search as string | undefined,
      role: role as string | undefined,
      active: active !== undefined ? active === "true" : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };
    
    const result = await listZendeskUsers(filters);
    res.json(result);
  } catch (error) {
    console.error("[ZendeskSupportUsers] List users error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno do servidor",
    });
  }
});

export default router;
