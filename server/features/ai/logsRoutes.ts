import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../core/middleware/auth.js";
import { getOpenaiLogs, getOpenaiLogById } from "./openaiService.js";

const router = Router();

router.get("/api/openai-logs", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const requestType = req.query.request_type as string | undefined;
  
  const logs = await getOpenaiLogs(limit, requestType);
  
  res.json({
    logs: logs.map(log => ({
      id: log.id,
      request_type: log.requestType,
      model_name: log.modelName,
      tokens_prompt: log.tokensPrompt,
      tokens_completion: log.tokensCompletion,
      tokens_total: log.tokensTotal,
      duration_ms: log.durationMs,
      success: log.success,
      error_message: log.errorMessage,
      context_type: log.contextType,
      context_id: log.contextId,
      created_at: log.createdAt?.toISOString(),
    })),
    total: logs.length,
  });
});

router.get("/api/openai-logs/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid log ID" });
  }
  
  const log = await getOpenaiLogById(id);
  
  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }
  
  res.json({
    id: log.id,
    request_type: log.requestType,
    model_name: log.modelName,
    prompt_system: log.promptSystem,
    prompt_user: log.promptUser,
    response_raw: log.responseRaw,
    response_content: log.responseContent,
    tokens_prompt: log.tokensPrompt,
    tokens_completion: log.tokensCompletion,
    tokens_total: log.tokensTotal,
    duration_ms: log.durationMs,
    success: log.success,
    error_message: log.errorMessage,
    context_type: log.contextType,
    context_id: log.contextId,
    created_at: log.createdAt?.toISOString(),
  });
});

export default router;
