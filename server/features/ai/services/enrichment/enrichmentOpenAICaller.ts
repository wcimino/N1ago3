import { callOpenAI, ToolDefinition } from "../openaiApiService.js";
import { createZendeskKnowledgeBaseTool } from "../aiTools.js";
import type { IntentWithArticle } from "../../storage/knowledgeBaseStorage.js";
import type { EnrichmentConfig, OpenAIPayload } from "./types.js";

function buildCreateEnrichmentSuggestionTool(intentWithArticle: IntentWithArticle): ToolDefinition {
  return {
    name: "create_enrichment_suggestion",
    description: "Registra uma sugestão de refinamento do artigo existente, melhorando a pergunta, resposta, variações e keywords.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["update", "skip"],
          description: "Ação a tomar: update (refinar o artigo), skip (ignorar pois já está bom)"
        },
        question: {
          type: "string",
          description: "Pergunta reformulada no formato que o cliente faria (ex: 'Como desbloquear meu cartão?'). Obrigatório se action=update."
        },
        answer: {
          type: "string",
          description: "Resposta direta para o cliente, sem linguagem de atendente. Instruções claras e objetivas. Obrigatório se action=update."
        },
        keywords: {
          type: "string",
          description: "Palavras-chave separadas por vírgula para busca (ex: 'desbloquear, liberar, bloqueado, travado'). Obrigatório se action=update."
        },
        questionVariation: {
          type: "array",
          items: { type: "string" },
          description: "4 a 6 formas alternativas de fazer a mesma pergunta (ex: ['Meu cartão está bloqueado', 'Como libero o cartão?']). Obrigatório se action=update."
        },
        updateReason: {
          type: "string",
          description: "Motivo do refinamento proposto (obrigatório se action=update)"
        },
        confidenceScore: {
          type: "number",
          description: "Nível de confiança de 0 a 100"
        },
        sourceArticles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              similarityScore: { type: "number" }
            }
          },
          description: "Artigos do Zendesk utilizados como referência (opcional)"
        },
        skipReason: {
          type: "string",
          description: "Motivo para ignorar (obrigatório se action=skip)"
        }
      },
      required: ["action"]
    },
    handler: async (args: any) => {
      return `Sugestão registrada para intenção #${intentWithArticle.intent.id}: action=${args.action}`;
    }
  };
}

function buildSynonymsContext(intentSynonyms: string[], subjectSynonyms: string[]): string {
  const hasIntentSynonyms = intentSynonyms && intentSynonyms.length > 0;
  const hasSubjectSynonyms = subjectSynonyms && subjectSynonyms.length > 0;
  
  if (!hasIntentSynonyms && !hasSubjectSynonyms) {
    return '';
  }
  
  let context = '\n\n---\n\n## Sinônimos para Busca\n\nUse estes termos alternativos na busca do Zendesk para obter resultados mais completos:\n';
  
  if (hasIntentSynonyms) {
    context += `- **Sinônimos da Intenção:** ${intentSynonyms.join(', ')}\n`;
  }
  
  if (hasSubjectSynonyms) {
    context += `- **Sinônimos do Assunto:** ${subjectSynonyms.join(', ')}\n`;
  }
  
  return context;
}

function buildUserPromptForIntent(intentWithArticle: IntentWithArticle, promptTemplate: string): string {
  const { intent, article } = intentWithArticle;
  const hasArticle = !!article;
  const hasIntentSynonyms = intent.synonyms && intent.synonyms.length > 0;
  const hasSubjectSynonyms = intent.subjectSynonyms && intent.subjectSynonyms.length > 0;
  
  let prompt = promptTemplate;
  
  let intentSynonymsSubstituted = false;
  let subjectSynonymsSubstituted = false;
  
  prompt = prompt
    .replace(/\{\{intencao_id\}\}/gi, String(intent.id))
    .replace(/\{\{intencao_nome\}\}/gi, intent.name)
    .replace(/\{\{assunto_nome\}\}/gi, intent.subjectName)
    .replace(/\{\{produto\}\}/gi, intent.productName);
  
  if (hasIntentSynonyms) {
    if (prompt.includes('{{intencao_sinonimos}}') || prompt.includes('{{#if_intencao_sinonimos}}')) {
      intentSynonymsSubstituted = true;
    }
    prompt = prompt
      .replace(/\{\{#if_intencao_sinonimos\}\}([\s\S]*?)\{\{\/if_intencao_sinonimos\}\}/gi, '$1')
      .replace(/\{\{intencao_sinonimos\}\}/gi, intent.synonyms.join(', '));
  } else {
    prompt = prompt
      .replace(/\{\{#if_intencao_sinonimos\}\}[\s\S]*?\{\{\/if_intencao_sinonimos\}\}/gi, '');
  }
  
  if (hasSubjectSynonyms) {
    if (prompt.includes('{{assunto_sinonimos}}') || prompt.includes('{{#if_assunto_sinonimos}}')) {
      subjectSynonymsSubstituted = true;
    }
    prompt = prompt
      .replace(/\{\{#if_assunto_sinonimos\}\}([\s\S]*?)\{\{\/if_assunto_sinonimos\}\}/gi, '$1')
      .replace(/\{\{assunto_sinonimos\}\}/gi, intent.subjectSynonyms.join(', '));
  } else {
    prompt = prompt
      .replace(/\{\{#if_assunto_sinonimos\}\}[\s\S]*?\{\{\/if_assunto_sinonimos\}\}/gi, '');
  }
  
  if (hasArticle) {
    const variationsText = article.questionVariation && article.questionVariation.length > 0 
      ? article.questionVariation.join(', ') 
      : "Sem variações";
    prompt = prompt
      .replace(/\{\{#if_artigo_existe\}\}([\s\S]*?)\{\{\/if_artigo_existe\}\}/gi, '$1')
      .replace(/\{\{#if_artigo_nao_existe\}\}[\s\S]*?\{\{\/if_artigo_nao_existe\}\}/gi, '')
      .replace(/\{\{artigo_id\}\}/gi, String(article.id))
      .replace(/\{\{pergunta\}\}/gi, article.question || "Sem pergunta")
      .replace(/\{\{resposta\}\}/gi, article.answer || "Sem resposta")
      .replace(/\{\{keywords\}\}/gi, article.keywords || "Sem keywords")
      .replace(/\{\{variacoes\}\}/gi, variationsText);
  } else {
    prompt = prompt
      .replace(/\{\{#if_artigo_nao_existe\}\}([\s\S]*?)\{\{\/if_artigo_nao_existe\}\}/gi, '$1')
      .replace(/\{\{#if_artigo_existe\}\}[\s\S]*?\{\{\/if_artigo_existe\}\}/gi, '');
  }
  
  const synonymsToAppend = {
    intentSynonyms: (!intentSynonymsSubstituted && hasIntentSynonyms) ? intent.synonyms : [],
    subjectSynonyms: (!subjectSynonymsSubstituted && hasSubjectSynonyms) ? intent.subjectSynonyms : []
  };
  
  const synonymsContext = buildSynonymsContext(synonymsToAppend.intentSynonyms, synonymsToAppend.subjectSynonyms);
  if (synonymsContext) {
    prompt += synonymsContext;
  }
  
  return prompt;
}

export async function callOpenAIForIntent(
  intentWithArticle: IntentWithArticle,
  config: EnrichmentConfig
): Promise<OpenAIPayload> {
  const { intent } = intentWithArticle;
  
  if (!config.promptTemplate || !config.promptTemplate.trim()) {
    throw new Error("Enrichment prompt template is required. Please configure it in the database.");
  }
  
  if (!config.promptSystem || !config.promptSystem.trim()) {
    throw new Error("Enrichment system prompt is required. Please configure it in the database.");
  }

  const userPrompt = buildUserPromptForIntent(intentWithArticle, config.promptTemplate);

  const tools: ToolDefinition[] = [
    buildCreateEnrichmentSuggestionTool(intentWithArticle)
  ];

  if (config.useZendeskKnowledgeBaseTool) {
    const zendeskTool = createZendeskKnowledgeBaseTool({
      produto: intent.productName,
      subproduto: intent.subproductName || undefined,
      assunto: intent.subjectName || undefined,
      intencao: intent.name,
    });
    const originalHandler = zendeskTool.handler;
    zendeskTool.handler = async (args) => {
      console.log(`[OpenAI Caller] Zendesk KB search for intent #${intent.id}: keywords=${args.keywords}, produto=${intent.productName}, assunto=${intent.subjectName}`);
      return originalHandler(args);
    };
    tools.unshift(zendeskTool);
  }

  console.log(`[OpenAI Caller] Calling OpenAI for intent #${intent.id}`);

  const result = await callOpenAI({
    requestType: "enrichment_agent",
    modelName: config.modelName,
    promptSystem: config.promptSystem,
    promptUser: userPrompt,
    tools,
    maxTokens: 4096,
    maxIterations: 5,
    contextType: "enrichment",
    contextId: `enrichment-intent-${intent.id}`,
    finalToolName: "create_enrichment_suggestion"
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || `Failed to process intent #${intent.id}`,
      openaiLogId: result.logId
    };
  }

  if (!result.toolResult) {
    return {
      success: true,
      action: 'skip',
      skipReason: `Nenhuma sugestão gerada para intenção #${intent.id}`,
      openaiLogId: result.logId
    };
  }

  const toolResult = result.toolResult;
  
  const validActions = ['update', 'skip'];
  if (!toolResult.action || !validActions.includes(toolResult.action)) {
    return {
      success: true,
      action: 'skip',
      skipReason: toolResult.skipReason || `Resposta inválida da OpenAI para intenção #${intent.id}`,
      confidenceScore: toolResult.confidenceScore,
      openaiLogId: result.logId
    };
  }

  return {
    success: true,
    action: toolResult.action,
    question: toolResult.question,
    answer: toolResult.answer,
    keywords: toolResult.keywords,
    questionVariation: toolResult.questionVariation || [],
    updateReason: toolResult.updateReason,
    skipReason: toolResult.skipReason,
    confidenceScore: toolResult.confidenceScore,
    sourceArticles: toolResult.sourceArticles?.map((s: any) => ({
      id: s.id,
      title: s.title,
      similarityScore: s.similarityScore
    })) || [],
    openaiLogId: result.logId
  };
}
