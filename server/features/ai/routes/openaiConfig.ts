import { Router, type Request, type Response } from "express";
import { openaiLogsStorage } from "../storage/openaiLogsStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";

const router = Router();

export const VALID_CONFIG_TYPES = ["summary", "classification", "response", "demand_finder", "solution_provider", "closer", "topic_classification"];

function formatConfigResponse(config: any) {
  return {
    id: config.id,
    config_type: config.configType,
    enabled: config.enabled,
    trigger_event_types: config.triggerEventTypes,
    trigger_author_types: config.triggerAuthorTypes,
    prompt_system: config.promptSystem ?? null,
    prompt_template: config.promptTemplate,
    response_format: config.responseFormat ?? null,
    model_name: config.modelName,
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  };
}

router.get("/api/openai-config/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!VALID_CONFIG_TYPES.includes(configType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${VALID_CONFIG_TYPES.join(", ")}` });
  }

  const config = await openaiLogsStorage.getOpenaiApiConfig(configType);
  
  if (!config) {
    return res.status(404).json({ 
      error: `Configuration for '${configType}' not found in database. Please create the configuration first.` 
    });
  }

  res.json(formatConfigResponse(config));
});

router.put("/api/openai-config/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!VALID_CONFIG_TYPES.includes(configType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${VALID_CONFIG_TYPES.join(", ")}` });
  }

  const { enabled, trigger_event_types, trigger_author_types, prompt_system, prompt_template, response_format, model_name } = req.body;

  const hasPromptTemplate = prompt_template && prompt_template.trim();
  const hasPromptSystem = prompt_system && prompt_system.trim();
  
  if (!hasPromptTemplate && !hasPromptSystem) {
    return res.status(400).json({ error: "Either prompt_template or prompt_system is required" });
  }
  
  const finalPromptTemplate = hasPromptTemplate ? prompt_template : prompt_system;

  const existingConfig = await openaiLogsStorage.getOpenaiApiConfig(configType);
  
  let finalPromptSystem: string | null;
  if (prompt_system !== undefined) {
    finalPromptSystem = prompt_system;
  } else if (existingConfig) {
    finalPromptSystem = existingConfig.promptSystem;
  } else {
    finalPromptSystem = null;
  }

  let finalResponseFormat: string | null;
  if (response_format !== undefined) {
    finalResponseFormat = response_format;
  } else if (existingConfig) {
    finalResponseFormat = existingConfig.responseFormat;
  } else {
    finalResponseFormat = null;
  }
  
  const config = await openaiLogsStorage.upsertOpenaiApiConfig(configType, {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptSystem: finalPromptSystem,
    promptTemplate: finalPromptTemplate,
    responseFormat: finalResponseFormat,
    modelName: model_name || "gpt-4o-mini",
  });

  res.json(formatConfigResponse(config));
});

export default router;
