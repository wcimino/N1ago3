import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { ZendeskArticlesStorage } from "../../external-sources/zendesk/storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../../external-sources/zendesk/storage/zendeskArticleStatisticsStorage.js";
import { knowledgeSubjectsStorage } from "../../knowledge/storage/knowledgeSubjectsStorage.js";
import { knowledgeIntentsStorage } from "../../knowledge/storage/knowledgeIntentsStorage.js";
import { generateEmbedding as generateZendeskEmbedding } from "../../external-sources/zendesk/services/embeddingService.js";
import { generateEmbedding as generateKBEmbedding } from "./knowledgeBaseEmbeddingService.js";
import type { ToolDefinition } from "./openaiApiService.js";

// Threshold mínimo de relevância para resultados de busca (5%)
// Artigos abaixo desse threshold são considerados não relevantes
// Baseado nos scores típicos de ts_rank_cd e Zendesk API
const RELEVANCE_THRESHOLD = 0.05;

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

      let articles: Array<{
        productStandard: string;
        subproductStandard: string | null;
        intent: string;
        description: string;
        resolution: string;
        relevanceScore: number;
      }>;
      
      if (args.keywords && args.keywords.trim().length > 0) {
        const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();
        
        if (hasEmbeddings) {
          try {
            console.log("[KB Tool] Using semantic search with embeddings");
            const { embedding: queryEmbedding } = await generateKBEmbedding(args.keywords);
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
              productStandard: a.productStandard,
              subproductStandard: a.subproductStandard,
              intent: a.intent,
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
                productStandard: a.productStandard,
                subproductStandard: a.subproductStandard,
                intent: a.intent,
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
              productStandard: a.productStandard,
              subproductStandard: a.subproductStandard,
              intent: a.intent,
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
          productStandard: a.productStandard,
          subproductStandard: a.subproductStandard,
          intent: a.intent,
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
      
      const articleList = articles.map(a => ({
        product: a.productStandard,
        subproduct: a.subproductStandard,
        subject: resolvedSubject,
        intent: resolvedIntent || a.intent,
        description: a.description,
        resolution: a.resolution,
        relevance: a.relevanceScore.toFixed(2)
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

export function createProductCatalogTool(): ToolDefinition {
  return {
    name: "search_product_catalog",
    description: "Busca produtos no catálogo hierárquico. Use para encontrar os produtos válidos e suas classificações corretas (fullName).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termo de busca para filtrar produtos (ex: 'cartão', 'empréstimo', 'antecipação'). Deixe vazio para listar todos."
        }
      },
      required: []
    },
    handler: async (args: { query?: string }) => {
      const allProducts = await productCatalogStorage.getAll();
      
      let products = allProducts;
      if (args.query) {
        const query = args.query.toLowerCase();
        products = allProducts.filter(p => 
          p.produto.toLowerCase().includes(query) ||
          (p.subproduto && p.subproduto.toLowerCase().includes(query)) ||
          p.fullName.toLowerCase().includes(query)
        );
      }
      
      if (products.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum produto encontrado no catálogo",
          products: [] 
        });
      }
      
      const productList = products.map(p => ({
        fullName: p.fullName,
        produto: p.produto,
        subproduto: p.subproduto
      }));
      
      return JSON.stringify({
        message: `Encontrados ${products.length} produtos no catálogo`,
        products: productList
      });
    }
  };
}

export function createZendeskKnowledgeBaseTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_zendesk",
    description: "Busca artigos na base de conhecimento do Zendesk (Help Center) usando busca semântica inteligente. Use para encontrar artigos de ajuda, FAQs e documentação pública. A busca entende o significado da sua consulta e encontra os artigos mais relevantes.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Descreva o que você está buscando. Pode ser uma pergunta, palavras-chave ou uma frase descrevendo o problema/tema."
        },
        section: {
          type: "string",
          description: "ID da seção para filtrar artigos (opcional)"
        }
      },
      required: []
    },
    handler: async (args: { keywords?: string; section?: string }) => {
      let articles: Array<{
        id: number;
        zendeskId: string;
        title: string;
        body: string | null;
        sectionName: string | null;
        htmlUrl: string | null;
        similarity: number;
      }> = [];
      
      if (args.keywords && args.keywords.trim().length > 0) {
        const stats = await ZendeskArticlesStorage.getEmbeddingStats();
        
        if (stats.withEmbedding > 0) {
          try {
            const { embedding: queryEmbedding } = await generateZendeskEmbedding(args.keywords);
            const semanticResults = await ZendeskArticlesStorage.searchBySimilarity(
              queryEmbedding,
              { limit: 5 }
            );
            
            articles = semanticResults.map(a => ({
              id: a.id,
              zendeskId: a.zendeskId,
              title: a.title,
              body: a.body,
              sectionName: a.sectionName,
              htmlUrl: a.htmlUrl,
              similarity: a.similarity,
            }));
            
            console.log(`[Zendesk KB Tool] Semantic search found ${articles.length} articles`);
          } catch (error) {
            console.error("[Zendesk KB Tool] Semantic search failed, falling back to full-text:", error);
            const searchResults = await ZendeskArticlesStorage.searchArticlesWithRelevance(
              args.keywords,
              { sectionId: args.section, limit: 10 }
            );
            articles = searchResults
              .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
              .slice(0, 5)
              .map(a => ({
                id: a.id,
                zendeskId: a.zendeskId,
                title: a.title,
                body: a.body,
                sectionName: a.sectionName,
                htmlUrl: a.htmlUrl,
                similarity: Math.round(a.relevanceScore * 100),
              }));
          }
        } else {
          console.log("[Zendesk KB Tool] No embeddings available, using full-text search");
          const searchResults = await ZendeskArticlesStorage.searchArticlesWithRelevance(
            args.keywords,
            { sectionId: args.section, limit: 10 }
          );
          articles = searchResults
            .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
            .slice(0, 5)
            .map(a => ({
              id: a.id,
              zendeskId: a.zendeskId,
              title: a.title,
              body: a.body,
              sectionName: a.sectionName,
              htmlUrl: a.htmlUrl,
              similarity: Math.round(a.relevanceScore * 100),
            }));
        }
      } else {
        const allArticles = await ZendeskArticlesStorage.getAllArticles({
          sectionId: args.section,
          limit: 5
        });
        articles = allArticles.map(a => ({
          id: a.id,
          zendeskId: a.zendeskId,
          title: a.title,
          body: a.body,
          sectionName: a.sectionName,
          htmlUrl: a.htmlUrl,
          similarity: 0,
        }));
      }
      
      if (articles.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento do Zendesk",
          articles: [] 
        });
      }
      
      try {
        await ZendeskArticleStatisticsStorage.recordMultipleArticleViews(
          articles.map(a => ({ id: a.id })),
          { keywords: args.keywords, sectionId: args.section }
        );
      } catch (error) {
        console.error("[Zendesk KB Tool] Failed to record article statistics:", error);
      }
      
      const articleList = articles.map(a => ({
        id: a.zendeskId,
        internalId: a.id,
        title: a.title,
        section: a.sectionName,
        relevance: a.similarity,
        body: a.body ? a.body.substring(0, 500) + (a.body.length > 500 ? "..." : "") : null,
        url: a.htmlUrl
      }));
      
      return JSON.stringify({
        message: `Encontrados ${articles.length} artigos mais relevantes do Zendesk (busca semântica)`,
        articles: articleList
      });
    }
  };
}

export interface ToolFlags {
  useKnowledgeBaseTool?: boolean;
  useProductCatalogTool?: boolean;
  useZendeskKnowledgeBaseTool?: boolean;
}

export function buildToolsFromFlags(flags: ToolFlags): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (flags.useKnowledgeBaseTool) {
    tools.push(createKnowledgeBaseTool());
  }
  
  if (flags.useProductCatalogTool) {
    tools.push(createProductCatalogTool());
  }
  
  if (flags.useZendeskKnowledgeBaseTool) {
    tools.push(createZendeskKnowledgeBaseTool());
  }
  
  return tools;
}
