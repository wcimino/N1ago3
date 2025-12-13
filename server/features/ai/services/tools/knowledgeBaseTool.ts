import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import type { ToolDefinition } from "../openaiApiService.js";

export function createKnowledgeBaseArticlesTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_articles",
    description: "Busca artigos na base de conhecimento. Use para encontrar informações sobre produtos, procedimentos e resoluções de problemas.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "number",
          description: "ID do produto para filtrar"
        },
        keywords: {
          type: "string",
          description: "Palavras-chave ou descrição do problema para buscar no conteúdo dos artigos"
        }
      },
      required: []
    },
    handler: async (args: { productId?: number; keywords?: string }) => {
      const result = await runKnowledgeBaseSearch({
        productId: args.productId,
        keywords: args.keywords,
        limit: 5
      });
      
      if (result.articles.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento",
          articles: [],
          productId: args.productId || null
        });
      }
      
      const articleList = result.articles.map((a) => ({
        source: "article" as const,
        product: a.productStandard,
        subproduct: a.subproductStandard,
        description: a.description,
        resolution: a.resolution,
        relevance: a.relevanceScore.toFixed(2)
      }));
      
      return JSON.stringify({
        message: `Encontrados ${result.articles.length} artigos relevantes`,
        articles: articleList,
        productId: result.productId
      });
    }
  };
}
