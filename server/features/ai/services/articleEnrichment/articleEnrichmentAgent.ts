import { storage } from "../../../../storage/index.js";
import { callOpenAI, type ToolDefinition } from "../openaiApiService.js";
import { replacePromptVariables, type PromptVariables } from "../promptUtils.js";
import { generalSettingsStorage } from "../../storage/generalSettingsStorage.js";
import type { IntentWithArticle } from "../../storage/knowledgeBaseTypes.js";
import type { ArticleEnrichmentContext, ArticleEnrichmentResult } from "./types.js";
import { buildArticleEnrichmentContext } from "./types.js";
import { retrieveZendeskArticles, formatRetrievedArticlesForPrompt } from "./articleRetrieval.js";

const CONFIG_KEY = "article_enrichment";

function buildCreateSuggestionTool(context: ArticleEnrichmentContext): ToolDefinition {
  return {
    name: "create_article_enrichment_suggestion",
    description: "Registra uma sugestão de refinamento do artigo existente. A pergunta original NÃO deve ser alterada. Refine a resposta, variações, keywords e versões normalizadas.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["update", "skip"],
          description: "Ação a tomar: update (refinar o artigo), skip (ignorar pois já está bom)"
        },
        answer: {
          type: "string",
          description: "Resposta refinada/montada com informações encontradas na base do Zendesk. Resposta direta para o cliente, sem linguagem de atendente. Instruções claras e objetivas. Obrigatório se action=update."
        },
        keywords: {
          type: "string",
          description: "Palavras-chave separadas por vírgula para facilitar busca (ex: 'desbloquear, liberar, bloqueado, travado, senha'). Obrigatório se action=update."
        },
        questionVariation: {
          type: "array",
          items: { type: "string" },
          description: "4 a 6 formas alternativas de fazer a mesma pergunta, como o cliente perguntaria (ex: ['Meu cartão está bloqueado', 'Como libero o cartão?', 'Cartão travado']). Obrigatório se action=update."
        },
        questionNormalized: {
          type: "array",
          items: { type: "string" },
          minItems: 10,
          maxItems: 10,
          description: "OBRIGATÓRIO: Exatamente 10 versões normalizadas e curtas (até 10 palavras cada) para busca semântica. Sem pronomes, sem polidez, sem 'como faço'. Deve representar o núcleo semântico da demanda. Exemplo para 'Como desbloquear cartão': ['desbloquear cartao credito', 'liberar cartao bloqueado', 'cartao bloqueado senha incorreta', 'reativar cartao ifood pago', 'erro desbloqueio cartao app', 'problema desbloqueio cartao', 'nao consigo desbloquear cartao', 'cartao recusado bloqueio', 'desativar bloqueio cartao', 'ativar cartao bloqueado']. Este campo é OBRIGATÓRIO quando action=update."
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
      return `Sugestão registrada para intenção #${context.intentId}: action=${args.action}`;
    }
  };
}

function buildPromptVariablesFromContext(context: ArticleEnrichmentContext): PromptVariables {
  const hasArticle = !!context.article;
  
  return {
    intencaoId: String(context.intentId),
    intencaoNome: context.intentName,
    intencaoSinonimos: context.intentSynonyms.length > 0 ? context.intentSynonyms.join(", ") : null,
    assuntoNome: context.subjectName,
    assuntoSinonimos: context.subjectSynonyms.length > 0 ? context.subjectSynonyms.join(", ") : null,
    produtoNome: context.productName,
    subprodutoNome: context.subproductName,
    artigoExiste: hasArticle,
    artigoId: hasArticle && context.article ? String(context.article.id) : null,
    artigoPergunta: context.article?.question || null,
    artigoResposta: context.article?.answer || null,
    artigoKeywords: context.article?.keywords || null,
    artigoVariacoes: context.article?.questionVariation?.join(", ") || null,
  };
}

export class ArticleEnrichmentAgent {
  static async process(intentWithArticle: IntentWithArticle): Promise<ArticleEnrichmentResult> {
    const context = buildArticleEnrichmentContext(intentWithArticle);
    
    try {
      const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
      
      if (!config || !config.enabled) {
        console.log(`[ArticleEnrichmentAgent] Agent is disabled or no config found`);
        return {
          success: false,
          error: "Agent is disabled or configuration not found",
        };
      }

      if (!config.promptTemplate || !config.promptTemplate.trim()) {
        return {
          success: false,
          error: "Prompt template is required. Please configure it in the database.",
        };
      }

      let effectivePromptSystem = config.promptSystem || "";
      if (config.useGeneralSettings) {
        const generalSettings = await generalSettingsStorage.getConcatenatedContent();
        if (generalSettings) {
          effectivePromptSystem = generalSettings + (effectivePromptSystem ? "\n\n" + effectivePromptSystem : "");
        }
      }

      console.log(`[ArticleEnrichmentAgent] Processing intent #${context.intentId} (${context.intentName})`);

      let retrievedArticlesText = "";
      let retrievalLogId: number | null = null;
      let retrievedSourceArticles: Array<{ id: string; title: string; similarityScore: number }> = [];
      
      if (config.useZendeskKnowledgeBaseTool) {
        console.log(`[ArticleEnrichmentAgent] Running RAG retrieval for intent #${context.intentId}...`);
        const retrievalResult = await retrieveZendeskArticles(context, { limit: 5, minSimilarity: 50 });
        retrievedArticlesText = formatRetrievedArticlesForPrompt(retrievalResult.articles);
        retrievalLogId = retrievalResult.embeddingLogId;
        
        retrievedSourceArticles = retrievalResult.articles.map(a => ({
          id: a.zendeskId,
          title: a.title,
          similarityScore: a.similarity,
        }));
        
        console.log(`[ArticleEnrichmentAgent] Retrieved ${retrievalResult.articles.length} articles for context (embeddingLogId=${retrievalLogId})`);
        if (retrievalResult.articles.length > 0) {
          console.log(`[ArticleEnrichmentAgent] Top articles: ${retrievalResult.articles.slice(0, 3).map(a => `"${a.title}" (${a.similarity}%)`).join(", ")}`);
        }
      }

      const variables = buildPromptVariablesFromContext(context);
      const systemPrompt = effectivePromptSystem ? replacePromptVariables(effectivePromptSystem, variables) : undefined;
      let userPrompt = replacePromptVariables(config.promptTemplate, variables);

      if (retrievedArticlesText) {
        userPrompt += `\n\n## Artigos Relevantes do Zendesk (para referência)\n${retrievedArticlesText}`;
      }

      if (config.responseFormat) {
        userPrompt += `\n\n## Formato da Resposta\n${config.responseFormat}`;
      }

      const tools: ToolDefinition[] = [buildCreateSuggestionTool(context)];

      const result = await callOpenAI({
        requestType: CONFIG_KEY,
        modelName: config.modelName || "gpt-4o-mini",
        promptSystem: systemPrompt || null,
        promptUser: userPrompt,
        tools,
        maxTokens: 4096,
        maxIterations: 2,
        contextType: "article_enrichment",
        contextId: `intent-${context.intentId}`,
        finalToolName: "create_article_enrichment_suggestion",
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || `Failed to process intent #${context.intentId}`,
          openaiLogId: result.logId,
        };
      }

      if (!result.toolResult) {
        return {
          success: true,
          action: "skip",
          skipReason: `Nenhuma sugestão gerada para intenção #${context.intentId}`,
          openaiLogId: result.logId,
        };
      }

      const toolResult = result.toolResult;
      const validActions = ["update", "skip"];
      
      if (!toolResult.action || !validActions.includes(toolResult.action)) {
        return {
          success: true,
          action: "skip",
          skipReason: toolResult.skipReason || `Resposta inválida para intenção #${context.intentId}`,
          confidenceScore: toolResult.confidenceScore,
          openaiLogId: result.logId,
        };
      }

      if (toolResult.action === "update") {
        const missingFields: string[] = [];
        if (!toolResult.answer?.trim()) missingFields.push("answer");
        if (!toolResult.keywords?.trim()) missingFields.push("keywords");
        if (!toolResult.updateReason?.trim()) missingFields.push("updateReason");
        if (!Array.isArray(toolResult.questionVariation) || toolResult.questionVariation.length < 4) {
          missingFields.push("questionVariation (min 4)");
        }
        
        let finalQuestionNormalized = toolResult.questionNormalized || [];
        
        if (!Array.isArray(finalQuestionNormalized) || finalQuestionNormalized.length < 5) {
          console.warn(`[ArticleEnrichmentAgent] questionNormalized missing or incomplete (${finalQuestionNormalized.length}/5). Auto-generating...`);
          
          const baseQuestions: string[] = [];
          if (context.article?.question) baseQuestions.push(context.article.question);
          if (Array.isArray(toolResult.questionVariation)) {
            baseQuestions.push(...toolResult.questionVariation);
          }
          
          const normalized = new Set<string>();
          for (const q of baseQuestions) {
            const clean = q
              .toLowerCase()
              .replace(/^(como|por que|porque|o que|qual|quais|onde|quando|quem|eu|meu|minha|me|por favor|preciso|gostaria|poderia|pode|consegue|fazer para|faço para|faz para)\s*/gi, "")
              .replace(/[?!.,;:]+/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .split(" ")
              .slice(0, 10)
              .join(" ");
            
            if (clean.length >= 5 && clean.split(" ").length >= 2) {
              normalized.add(clean);
            }
          }
          
          if (toolResult.keywords) {
            const keywordPhrases = toolResult.keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 3);
            for (const kp of keywordPhrases.slice(0, 3)) {
              if (kp.split(" ").length >= 2) {
                normalized.add(kp.slice(0, 50).trim());
              }
            }
          }
          
          const uniqueNormalized = Array.from(normalized).slice(0, 5);
          
          while (uniqueNormalized.length < 5 && context.intentName) {
            const fallback = `${context.intentName.toLowerCase()} ${context.productName?.toLowerCase() || ""}`.trim().slice(0, 40);
            if (!uniqueNormalized.includes(fallback)) {
              uniqueNormalized.push(fallback);
            } else {
              break;
            }
          }
          
          finalQuestionNormalized = uniqueNormalized;
          console.log(`[ArticleEnrichmentAgent] Auto-generated ${finalQuestionNormalized.length} normalized versions`);
        }
        
        if (missingFields.length > 0) {
          console.warn(`[ArticleEnrichmentAgent] Missing required fields for update: ${missingFields.join(", ")}`);
        }
        
        toolResult.questionNormalized = finalQuestionNormalized;
      }

      const sourceArticles = retrievedSourceArticles.length > 0 
        ? retrievedSourceArticles 
        : (toolResult.sourceArticles?.map((s: any) => ({
            id: s.id,
            title: s.title,
            similarityScore: s.similarityScore,
          })) || []);

      return {
        success: true,
        action: toolResult.action,
        answer: toolResult.answer,
        keywords: toolResult.keywords,
        questionVariation: toolResult.questionVariation || [],
        questionNormalized: toolResult.questionNormalized || [],
        updateReason: toolResult.updateReason,
        skipReason: toolResult.skipReason,
        confidenceScore: toolResult.confidenceScore,
        sourceArticles,
        openaiLogId: result.logId,
      };
    } catch (error: any) {
      console.error(`[ArticleEnrichmentAgent] Error processing intent #${context.intentId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to process intent",
      };
    }
  }

  static async shouldProcess(): Promise<boolean> {
    const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
    return !!(config && config.enabled);
  }
}
