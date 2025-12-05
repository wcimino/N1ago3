import { Router, type Request, type Response } from "express";
import { storage } from "../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../middleware/auth.js";

const router = Router();

const DEFAULT_PROMPT_TEMPLATE = `Você receberá informações sobre uma conversa de atendimento ao cliente.

RESUMO ATUAL:
{{RESUMO_ATUAL}}

ÚLTIMAS 20 MENSAGENS:
{{ULTIMAS_20_MENSAGENS}}

ÚLTIMA MENSAGEM RECEBIDA:
{{ULTIMA_MENSAGEM}}

Por favor, gere um resumo atualizado e conciso desta conversa, destacando:
- O problema ou solicitação principal do cliente
- As ações tomadas pelo atendente
- O status atual da conversa
- Informações importantes mencionadas`;

router.get("/api/openai-summary-config", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const config = await storage.getOpenaiSummaryConfig();
  
  if (!config) {
    return res.json({
      enabled: false,
      trigger_event_types: [],
      trigger_author_types: [],
      prompt_template: DEFAULT_PROMPT_TEMPLATE,
      model_name: "gpt-4o",
    });
  }

  res.json({
    id: config.id,
    enabled: config.enabled,
    trigger_event_types: config.triggerEventTypes,
    trigger_author_types: config.triggerAuthorTypes,
    prompt_template: config.promptTemplate,
    model_name: config.modelName,
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  });
});

router.put("/api/openai-summary-config", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { enabled, trigger_event_types, trigger_author_types, prompt_template, model_name } = req.body;

  if (prompt_template !== undefined && !prompt_template.trim()) {
    return res.status(400).json({ error: "prompt_template cannot be empty" });
  }

  const config = await storage.upsertOpenaiSummaryConfig({
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptTemplate: prompt_template || DEFAULT_PROMPT_TEMPLATE,
    modelName: model_name || "gpt-4o",
  });

  res.json({
    id: config.id,
    enabled: config.enabled,
    trigger_event_types: config.triggerEventTypes,
    trigger_author_types: config.triggerAuthorTypes,
    prompt_template: config.promptTemplate,
    model_name: config.modelName,
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  });
});

export default router;
