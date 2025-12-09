import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { 
  DEFAULT_PROMPTS, 
  DEFAULT_SYSTEM_PROMPTS, 
  DEFAULT_RESPONSE_FORMATS, 
  VALID_CONFIG_TYPES 
} from "../constants/defaultPrompts.js";

const router = Router();

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
    use_knowledge_base_tool: config.useKnowledgeBaseTool ?? false,
    use_product_catalog_tool: config.useProductCatalogTool ?? false,
    use_zendesk_knowledge_base_tool: config.useZendeskKnowledgeBaseTool ?? false,
    use_general_settings: config.useGeneralSettings ?? true,
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  };
}

function getDefaultConfig(configType: string) {
  return {
    enabled: false,
    trigger_event_types: [],
    trigger_author_types: [],
    prompt_system: DEFAULT_SYSTEM_PROMPTS[configType] || null,
    prompt_template: DEFAULT_PROMPTS[configType] || "",
    response_format: DEFAULT_RESPONSE_FORMATS[configType] || null,
    model_name: "gpt-4o-mini",
    use_knowledge_base_tool: false,
    use_product_catalog_tool: false,
    use_zendesk_knowledge_base_tool: false,
    use_general_settings: true,
    config_type: configType,
  };
}

router.get("/api/openai-config/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!VALID_CONFIG_TYPES.includes(configType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${VALID_CONFIG_TYPES.join(", ")}` });
  }

  const config = await storage.getOpenaiApiConfig(configType);
  
  if (!config) {
    return res.json(getDefaultConfig(configType));
  }

  res.json(formatConfigResponse(config));
});

router.put("/api/openai-config/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!VALID_CONFIG_TYPES.includes(configType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${VALID_CONFIG_TYPES.join(", ")}` });
  }

  const { enabled, trigger_event_types, trigger_author_types, prompt_system, prompt_template, response_format, model_name, use_knowledge_base_tool, use_product_catalog_tool, use_zendesk_knowledge_base_tool, use_general_settings } = req.body;

  if (prompt_template !== undefined && !prompt_template.trim()) {
    return res.status(400).json({ error: "prompt_template cannot be empty" });
  }

  const existingConfig = await storage.getOpenaiApiConfig(configType);
  
  let finalPromptSystem: string | null;
  if (prompt_system !== undefined) {
    finalPromptSystem = prompt_system;
  } else if (existingConfig) {
    finalPromptSystem = existingConfig.promptSystem;
  } else {
    finalPromptSystem = DEFAULT_SYSTEM_PROMPTS[configType] ?? null;
  }

  let finalResponseFormat: string | null;
  if (response_format !== undefined) {
    finalResponseFormat = response_format;
  } else if (existingConfig) {
    finalResponseFormat = existingConfig.responseFormat;
  } else {
    finalResponseFormat = DEFAULT_RESPONSE_FORMATS[configType] ?? null;
  }
  
  const config = await storage.upsertOpenaiApiConfig(configType, {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptSystem: finalPromptSystem,
    promptTemplate: prompt_template || DEFAULT_PROMPTS[configType] || "",
    responseFormat: finalResponseFormat,
    modelName: model_name || "gpt-4o-mini",
    useKnowledgeBaseTool: use_knowledge_base_tool ?? false,
    useProductCatalogTool: use_product_catalog_tool ?? false,
    useZendeskKnowledgeBaseTool: use_zendesk_knowledge_base_tool ?? false,
    useGeneralSettings: use_general_settings ?? true,
  });

  res.json(formatConfigResponse(config));
});

router.get("/api/openai-summary-config", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const config = await storage.getOpenaiApiConfig("summary");
  
  if (!config) {
    return res.json(getDefaultConfig("summary"));
  }

  res.json(formatConfigResponse(config));
});

router.put("/api/openai-summary-config", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { enabled, trigger_event_types, trigger_author_types, prompt_system, prompt_template, response_format, model_name } = req.body;

  if (prompt_template !== undefined && !prompt_template.trim()) {
    return res.status(400).json({ error: "prompt_template cannot be empty" });
  }

  const existingConfig = await storage.getOpenaiApiConfig("summary");

  let finalPromptSystem: string | null;
  if (prompt_system !== undefined) {
    finalPromptSystem = prompt_system;
  } else if (existingConfig) {
    finalPromptSystem = existingConfig.promptSystem;
  } else {
    finalPromptSystem = DEFAULT_SYSTEM_PROMPTS.summary ?? null;
  }

  let finalResponseFormat: string | null;
  if (response_format !== undefined) {
    finalResponseFormat = response_format;
  } else if (existingConfig) {
    finalResponseFormat = existingConfig.responseFormat;
  } else {
    finalResponseFormat = DEFAULT_RESPONSE_FORMATS.summary ?? null;
  }

  const config = await storage.upsertOpenaiApiConfig("summary", {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptSystem: finalPromptSystem,
    promptTemplate: prompt_template || DEFAULT_PROMPTS.summary,
    responseFormat: finalResponseFormat,
    modelName: model_name || "gpt-4o-mini",
  });

  res.json(formatConfigResponse(config));
});

export default router;
