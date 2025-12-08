import { Router, type Request, type Response } from "express";
import { openaiLogsStorage } from "../storage/openaiLogsStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

router.get("/api/openai/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const stats = await openaiLogsStorage.getOpenaiApiStats();
    res.json(stats);
  } catch (error) {
    console.error("[OpenAI Stats] Error:", error);
    res.status(500).json({ error: "Failed to get OpenAI stats" });
  }
});

export default router;
