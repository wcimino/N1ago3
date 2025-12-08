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

Por favor, gere um resumo atualizado e conciso desta conversa, destacando:
- O problema ou solicitação principal do cliente
- As ações tomadas pelo atendente
- O status atual da conversa
- Informações importantes mencionadas`,

  classification: `Analise a conversa de atendimento ao cliente abaixo e identifique:

1. **Produto**: Qual produto ou serviço o cliente está buscando ajuda? Exemplos: Conta Digital, Pix, Crédito, Cartão, Empréstimo, Investimentos, Seguros, etc.

2. **Intenção**: Qual é a intenção do cliente? Use uma das opções:
   - "contratar" - cliente quer adquirir/ativar um produto novo
   - "suporte" - cliente já tem o produto e precisa de ajuda
   - "cancelar" - cliente quer cancelar/encerrar um produto
   - "duvida" - cliente está tirando dúvidas antes de decidir
   - "reclamacao" - cliente está reclamando de algo
   - "outros" - outras situações

3. **Confiança**: De 0 a 100, qual a sua confiança na classificação?

**Mensagens da conversa:**
{{MENSAGENS}}

**Responda APENAS no formato JSON abaixo, sem texto adicional:**
{
  "product": "nome do produto",
  "intent": "tipo da intenção",
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
    prompt_template: config.promptTemplate,
    model_name: config.modelName,
    use_knowledge_base_tool: config.useKnowledgeBaseTool ?? false,
    use_product_catalog_tool: config.useProductCatalogTool ?? false,
    created_at: config.createdAt?.toISOString(),
    updated_at: config.updatedAt?.toISOString(),
  };
}

function getDefaultConfig(configType: string) {
  return {
    enabled: false,
    trigger_event_types: [],
    trigger_author_types: [],
    prompt_template: DEFAULT_PROMPTS[configType] || "",
    model_name: "gpt-4o-mini",
    use_knowledge_base_tool: false,
    use_product_catalog_tool: false,
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

  const { enabled, trigger_event_types, trigger_author_types, prompt_template, model_name, use_knowledge_base_tool, use_product_catalog_tool } = req.body;

  if (prompt_template !== undefined && !prompt_template.trim()) {
    return res.status(400).json({ error: "prompt_template cannot be empty" });
  }

  const config = await storage.upsertOpenaiApiConfig(configType, {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptTemplate: prompt_template || DEFAULT_PROMPTS[configType] || "",
    modelName: model_name || "gpt-4o-mini",
    useKnowledgeBaseTool: use_knowledge_base_tool ?? false,
    useProductCatalogTool: use_product_catalog_tool ?? false,
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
  const { enabled, trigger_event_types, trigger_author_types, prompt_template, model_name } = req.body;

  if (prompt_template !== undefined && !prompt_template.trim()) {
    return res.status(400).json({ error: "prompt_template cannot be empty" });
  }

  const config = await storage.upsertOpenaiApiConfig("summary", {
    enabled: enabled ?? false,
    triggerEventTypes: trigger_event_types || [],
    triggerAuthorTypes: trigger_author_types || [],
    promptTemplate: prompt_template || DEFAULT_PROMPTS.summary,
    modelName: model_name || "gpt-4o-mini",
  });

  res.json(formatConfigResponse(config));
});

export default router;
