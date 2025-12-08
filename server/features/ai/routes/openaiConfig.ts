import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

const DEFAULT_PROMPTS: Record<string, string> = {
  summary: `Você receberá informações sobre uma conversa de atendimento ao cliente.

RESUMO ATUAL:
{{RESUMO_ATUAL}}

ÚLTIMAS 20 MENSAGENS:
{{ULTIMAS_20_MENSAGENS}}

ÚLTIMA MENSAGEM RECEBIDA:
{{ULTIMA_MENSAGEM}}

Analise a conversa e gere um resumo estruturado em formato JSON com exatamente estes 4 campos:

{
  "clientRequest": "Descrição clara e concisa do problema ou solicitação principal do cliente",
  "agentActions": "Ações tomadas pelo atendente para resolver a demanda",
  "currentStatus": "Status atual da conversa (em aberto, aguardando cliente, resolvido, etc)",
  "importantInfo": "Informações importantes mencionadas (valores, datas, documentos, etc)"
}

**REGRAS:**
- Responda APENAS com o JSON, sem texto adicional
- Cada campo deve ter no máximo 2-3 frases
- Se alguma informação não estiver disponível, use "Não informado"
- Seja objetivo e direto`,

  classification: `Analise a conversa de atendimento ao cliente abaixo e classifique conforme as instruções.

**INSTRUÇÕES:**
1. Use a ferramenta search_product_catalog para buscar os produtos válidos no catálogo
2. Identifique qual produto do catálogo melhor corresponde ao assunto da conversa
3. O campo "product" deve ser exatamente um dos valores retornados pelo catálogo (use o fullName)
4. A intenção deve ser APENAS "contratar" ou "suporte":
   - "contratar" - cliente quer adquirir, ativar, simular ou contratar produto/serviço novo
   - "suporte" - qualquer outro atendimento (dúvidas, problemas, cancelamentos, reclamações)

**Mensagens da conversa:**
{{MENSAGENS}}

**Após buscar no catálogo, responda no formato JSON:**
{
  "product": "fullName exato do catálogo",
  "intent": "contratar ou suporte",
  "confidence": número de 0 a 100
}`,

  response: `Você é um assistente de atendimento ao cliente de uma instituição financeira. Sua tarefa é sugerir uma resposta profissional e empática para a última mensagem do cliente.

**RESUMO DA CONVERSA:**
{{RESUMO}}

**CLASSIFICAÇÃO:**
{{CLASSIFICACAO}}

**HISTÓRICO DAS ÚLTIMAS 20 MENSAGENS:**
{{ULTIMAS_20_MENSAGENS}}

**ÚLTIMA MENSAGEM DO CLIENTE (a ser respondida):**
{{ULTIMA_MENSAGEM}}

**INSTRUÇÕES:**
1. Analise o contexto da conversa e a última mensagem do cliente
2. Considere o produto e a intenção identificados na classificação
3. Gere uma resposta profissional, empática e útil
4. A resposta deve ser clara, objetiva e resolver ou encaminhar a demanda do cliente
5. Use linguagem cordial e acessível
6. NÃO inclua saudações genéricas como "Olá" no início - vá direto ao ponto

**Responda APENAS com a mensagem sugerida, sem explicações adicionais.**`,
};

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
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  };
}

const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  summary: "Você é um assistente especializado em gerar resumos de conversas de atendimento ao cliente. Gere resumos concisos e informativos.",
  classification: "Você é um assistente especializado em classificar conversas de atendimento ao cliente.",
  response: `Você é um assistente de atendimento ao cliente especializado em serviços financeiros do iFood Pago.
Sua tarefa é gerar uma resposta profissional, empática e PRECISA para a última mensagem do cliente.

## REGRAS IMPORTANTES:
- A resposta deve ser clara, objetiva e resolver ou encaminhar a demanda
- Use linguagem cordial e acessível
- NÃO inclua saudações genéricas como "Olá" no início - vá direto ao ponto
- NÃO invente procedimentos`,
  learning: "Você é um assistente especializado em extrair conhecimento de conversas de atendimento para criar artigos de base de conhecimento.",
};

const DEFAULT_RESPONSE_FORMATS: Record<string, string> = {
  summary: `{
  "clientRequest": "Descrição do problema/solicitação do cliente",
  "agentActions": "Ações tomadas pelo atendente",
  "currentStatus": "Status atual (em aberto, aguardando, resolvido)",
  "importantInfo": "Valores, datas, documentos mencionados"
}`,
  classification: `{
  "product": "Nome do produto do catálogo",
  "intent": "contratar ou suporte",
  "confidence": 0-100
}`,
};

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
    config_type: configType,
  };
}

const VALID_CONFIG_TYPES = ["summary", "classification", "response", "learning"];

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

  const { enabled, trigger_event_types, trigger_author_types, prompt_system, prompt_template, response_format, model_name, use_knowledge_base_tool, use_product_catalog_tool, use_zendesk_knowledge_base_tool } = req.body;

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
