import { ZendeskArticlesStorage } from "../../../external-sources/zendesk/storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../../../external-sources/zendesk/storage/zendeskArticleStatisticsStorage.js";
import { generateEmbedding as generateZendeskEmbedding } from "../../../external-sources/zendesk/services/embeddingService.js";
import type { ToolDefinition } from "../openaiApiService.js";

const RELEVANCE_THRESHOLD = 0.05;

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
