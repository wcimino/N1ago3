import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

export const VALID_CONFIG_TYPES = ["summary", "classification", "response", "learning", "enrichment", "demand_finder", "solution_provider", "articles_and_solutions", "topic_classification"];

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
    use_subject_intent_tool: config.useSubjectIntentTool ?? false,
    use_zendesk_knowledge_base_tool: config.useZendeskKnowledgeBaseTool ?? false,
    use_objective_problem_tool: config.useObjectiveProblemTool ?? false,
    use_combined_knowledge_search_tool: config.useCombinedKnowledgeSearchTool ?? false,
    use_knowledge_suggestion_tool: config.useKnowledgeSuggestionTool ?? false,
    use_general_settings: config.useGeneralSettings ?? true,
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  };
}

router.get("/api/openai-config/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!VALID_CONFIG_TYPES.includes(configType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${VALID_CONFIG_TYPES.join(", ")}` });
  }

  const config = await storage.getOpenaiApiConfig(configType);
  
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

  const { enabled, trigger_event_types, trigger_author_types, prompt_system, prompt_template, response_format, model_name, use_knowledge_base_tool, use_product_catalog_tool, use_subject_intent_tool, use_zendesk_knowledge_base_tool, use_objective_problem_tool, use_combined_knowledge_search_tool, use_knowledge_suggestion_tool, use_general_settings } = req.body;

  const hasPromptTemplate = prompt_template && prompt_template.trim();
  const hasPromptSystem = prompt_system && prompt_system.trim();
  
  if (!hasPromptTemplate && !hasPromptSystem) {
    return res.status(400).json({ error: "Either prompt_template or prompt_system is required" });
  }
  
  const finalPromptTemplate = hasPromptTemplate ? prompt_template : prompt_system;

  const existingConfig = await storage.getOpenaiApiConfig(configType);
  
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
  
  const config = await storage.upsertOpenaiApiConfig(configType, {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptSystem: finalPromptSystem,
    promptTemplate: finalPromptTemplate,
    responseFormat: finalResponseFormat,
    modelName: model_name || "gpt-4o-mini",
    useKnowledgeBaseTool: use_knowledge_base_tool ?? false,
    useProductCatalogTool: use_product_catalog_tool ?? false,
    useSubjectIntentTool: use_subject_intent_tool ?? false,
    useZendeskKnowledgeBaseTool: use_zendesk_knowledge_base_tool ?? false,
    useObjectiveProblemTool: use_objective_problem_tool ?? false,
    useCombinedKnowledgeSearchTool: use_combined_knowledge_search_tool ?? false,
    useKnowledgeSuggestionTool: use_knowledge_suggestion_tool ?? false,
    useGeneralSettings: use_general_settings ?? true,
  });

  res.json(formatConfigResponse(config));
});

router.get("/api/openai-summary-config", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const config = await storage.getOpenaiApiConfig("summary");
  
  if (!config) {
    return res.status(404).json({ 
      error: "Summary configuration not found in database. Please create the configuration first." 
    });
  }

  res.json(formatConfigResponse(config));
});

router.put("/api/openai-summary-config", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { 
    enabled, 
    trigger_event_types, 
    trigger_author_types, 
    prompt_system, 
    prompt_template, 
    response_format, 
    model_name,
    use_knowledge_base_tool,
    use_product_catalog_tool,
    use_subject_intent_tool,
    use_zendesk_knowledge_base_tool,
    use_objective_problem_tool,
    use_combined_knowledge_search_tool,
    use_knowledge_suggestion_tool,
    use_general_settings,
  } = req.body;

  const hasPromptTemplate = prompt_template && prompt_template.trim();
  const hasPromptSystem = prompt_system && prompt_system.trim();
  
  if (!hasPromptTemplate && !hasPromptSystem) {
    return res.status(400).json({ error: "Either prompt_template or prompt_system is required" });
  }
  
  const finalPromptTemplate = hasPromptTemplate ? prompt_template : prompt_system;

  const existingConfig = await storage.getOpenaiApiConfig("summary");

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

  const config = await storage.upsertOpenaiApiConfig("summary", {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptSystem: finalPromptSystem,
    promptTemplate: finalPromptTemplate,
    responseFormat: finalResponseFormat,
    modelName: model_name || "gpt-4o-mini",
    useKnowledgeBaseTool: use_knowledge_base_tool ?? false,
    useProductCatalogTool: use_product_catalog_tool ?? false,
    useSubjectIntentTool: use_subject_intent_tool ?? false,
    useZendeskKnowledgeBaseTool: use_zendesk_knowledge_base_tool ?? false,
    useObjectiveProblemTool: use_objective_problem_tool ?? false,
    useCombinedKnowledgeSearchTool: use_combined_knowledge_search_tool ?? false,
    useKnowledgeSuggestionTool: use_knowledge_suggestion_tool ?? false,
    useGeneralSettings: use_general_settings ?? true,
  });

  res.json(formatConfigResponse(config));
});

export default router;
