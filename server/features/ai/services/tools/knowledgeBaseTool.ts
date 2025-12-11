import { knowledgeBaseStorage } from "../../storage/knowledgeBaseStorage.js";
import { knowledgeSubjectsStorage } from "../../../knowledge/storage/knowledgeSubjectsStorage.js";
import { knowledgeIntentsStorage } from "../../../knowledge/storage/knowledgeIntentsStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../../storage/knowledgeBaseStatisticsStorage.js";
import { generateEmbedding as generateKBEmbedding } from "../knowledgeBaseEmbeddingService.js";
import type { ToolDefinition } from "../openaiApiService.js";

const RELEVANCE_THRESHOLD = 0.05;

interface EnrichedQueryParams {
  keywords: string;
  product?: string;
  subproduct?: string;
  subject?: string;
  intent?: string;
}

function buildEnrichedQueryText(params: EnrichedQueryParams): string {
  const parts: string[] = [];
  
  if (params.product) {
    parts.push(`Produto: ${params.product}`);
  }
  if (params.subproduct) {
    parts.push(`Subproduto: ${params.subproduct}`);
  }
  
  const descriptionParts: string[] = [];
  if (params.subject) {
    descriptionParts.push(params.subject);
  }
  if (params.intent) {
    descriptionParts.push(params.intent);
  }
  descriptionParts.push(params.keywords);
  
  parts.push(`Descrição: ${descriptionParts.join(". ")}`);
  parts.push(`Resolução: ${params.keywords}`);
  
  return parts.join("\n\n");
}

export function createKnowledgeBaseTool(): ToolDefinition {
  return {
    name: "search_knowledge_base",
    description: "Busca artigos na base de conhecimento. Use para encontrar informações sobre produtos, procedimentos e resoluções de problemas. Você pode filtrar por assunto (tema geral) e intenção (o que o cliente quer fazer).",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Nome do produto para filtrar (ex: 'Conta Digital', 'Cartão de Crédito')"
        },
        subject: {
          type: "string",
          description: "Assunto/tema do problema (ex: 'fatura', 'pagamento', 'limite'). Aceita sinônimos."
        },
        intent: {
          type: "string",
          description: "Intenção do cliente - o que ele quer fazer (ex: 'contestar', 'cancelar', 'parcelar'). Aceita sinônimos."
        },
        keywords: {
          type: "string",
          description: "Palavras-chave para buscar no conteúdo dos artigos"
        }
      },
      required: []
    },
    handler: async (args: { product?: string; subject?: string; intent?: string; keywords?: string }) => {
      let subjectId: number | undefined;
      let intentId: number | undefined;
      let resolvedSubject: string | undefined;
      let resolvedIntent: string | undefined;

      if (args.subject) {
        const subjects = await knowledgeSubjectsStorage.findByNameOrSynonym(args.subject);
        if (subjects.length > 0) {
          subjectId = subjects[0].id;
          resolvedSubject = subjects[0].name;
        }
      }

      if (args.intent) {
        const intents = await knowledgeIntentsStorage.findByNameOrSynonym(args.intent, subjectId);
        if (intents.length > 0) {
          intentId = intents[0].id;
          resolvedIntent = intents[0].name;
        }
      }

      interface ArticleWithRelevance {
        id: number;
        productStandard: string;
        subproductStandard: string | null;
        intentId: number | null;
        description: string;
        resolution: string;
        relevanceScore: number;
      }

      let articles: ArticleWithRelevance[];
      
      if (args.keywords && args.keywords.trim().length > 0) {
        const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();
        
        if (hasEmbeddings) {
          try {
            const queryText = buildEnrichedQueryText({
              keywords: args.keywords,
              product: args.product,
              subject: resolvedSubject,
              intent: resolvedIntent,
            });
            console.log(`[KB Tool] Using structured semantic search: product=${args.product || 'none'}, subject=${resolvedSubject || 'none'}, intent=${resolvedIntent || 'none'}`);
            
            const { embedding: queryEmbedding } = await generateKBEmbedding(queryText);
            const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
              queryEmbedding,
              {
                productStandard: args.product,
                subjectId: subjectId,
                intentId: intentId,
                limit: 5
              }
            );
            
            articles = semanticResults.map(a => ({
              id: a.id,
              productStandard: a.productStandard,
              subproductStandard: a.subproductStandard,
              intentId: a.intentId,
              description: a.description,
              resolution: a.resolution,
              relevanceScore: a.similarity
            }));
            
            console.log(`[KB Tool] Semantic search found ${articles.length} articles`);
          } catch (error) {
            console.error("[KB Tool] Semantic search failed, falling back to full-text:", error);
            const searchResults = await knowledgeBaseStorage.searchArticlesWithRelevance(args.keywords, {
              productStandard: args.product,
              subjectId: subjectId,
              intentId: intentId,
              limit: 10
            });
            articles = searchResults
              .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
              .slice(0, 5)
              .map(a => ({
                id: a.id,
                productStandard: a.productStandard,
                subproductStandard: a.subproductStandard,
                intentId: a.intentId,
                description: a.description,
                resolution: a.resolution,
                relevanceScore: a.relevanceScore
              }));
          }
        } else {
          console.log("[KB Tool] No embeddings available, using full-text search");
          const searchResults = await knowledgeBaseStorage.searchArticlesWithRelevance(args.keywords, {
            productStandard: args.product,
            subjectId: subjectId,
            intentId: intentId,
            limit: 10
          });
          articles = searchResults
            .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
            .slice(0, 5)
            .map(a => ({
              id: a.id,
              productStandard: a.productStandard,
              subproductStandard: a.subproductStandard,
              intentId: a.intentId,
              description: a.description,
              resolution: a.resolution,
              relevanceScore: a.relevanceScore
            }));
        }
      } else {
        const allArticles = await knowledgeBaseStorage.getAllArticles({
          productStandard: args.product,
          subjectId: subjectId,
          intentId: intentId,
          limit: 5
        });
        articles = allArticles.map(a => ({
          id: a.id,
          productStandard: a.productStandard,
          subproductStandard: a.subproductStandard,
          intentId: a.intentId,
          description: a.description,
          resolution: a.resolution,
          relevanceScore: 0
        }));
      }
      
      if (articles.length === 0) {
        const synonymInfo: string[] = [];
        if (args.subject && resolvedSubject && args.subject.toLowerCase() !== resolvedSubject.toLowerCase()) {
          synonymInfo.push(`assunto '${args.subject}' resolvido para '${resolvedSubject}'`);
        }
        if (args.intent && resolvedIntent && args.intent.toLowerCase() !== resolvedIntent.toLowerCase()) {
          synonymInfo.push(`intenção '${args.intent}' resolvido para '${resolvedIntent}'`);
        }
        
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento" + (synonymInfo.length > 0 ? ` (${synonymInfo.join(', ')})` : ""),
          articles: [],
          resolvedFilters: {
            subject: resolvedSubject || args.subject,
            intent: resolvedIntent || args.intent
          }
        });
      }
      
      try {
        await KnowledgeBaseStatisticsStorage.recordMultipleArticleViews(
          articles.map(a => ({ id: a.id })),
          { keywords: args.keywords }
        );
      } catch (error) {
        console.error("[KB Tool] Failed to record article views:", error);
      }
      
      const articleList = await Promise.all(articles.map(async (a) => {
        let intentName = resolvedIntent;
        if (!intentName && a.intentId) {
          const intent = await knowledgeIntentsStorage.getById(a.intentId);
          if (intent) {
            intentName = intent.name;
          }
        }
        return {
          product: a.productStandard,
          subproduct: a.subproductStandard,
          subject: resolvedSubject,
          intent: intentName || null,
          description: a.description,
          resolution: a.resolution,
          relevance: a.relevanceScore.toFixed(2)
        };
      }));
      
      return JSON.stringify({
        message: `Encontrados ${articles.length} artigos relevantes`,
        articles: articleList,
        resolvedFilters: {
          subject: resolvedSubject,
          intent: resolvedIntent
        }
      });
    }
  };
}
