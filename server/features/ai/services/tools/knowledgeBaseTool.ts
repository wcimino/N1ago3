import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import type { ToolDefinition } from "../openaiApiService.js";

export function createKnowledgeBaseArticlesTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_articles",
    description: "Busca artigos na base de conhecimento. Use para encontrar informações sobre produtos, procedimentos e resoluções de problemas.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Nome do produto para filtrar (ex: 'Conta Digital', 'Cartão de Crédito')"
        },
        subproduct: {
          type: "string",
          description: "Nome do subproduto para filtrar (ex: 'Gold', 'Platinum')"
        },
        keywords: {
          type: "string",
          description: "Palavras-chave ou descrição do problema para buscar no conteúdo dos artigos"
        }
      },
      required: []
    },
    handler: async (args: { product?: string; subproduct?: string; keywords?: string }) => {
      const result = await runKnowledgeBaseSearch({
        product: args.product,
        subproduct: args.subproduct,
        keywords: args.keywords,
        limit: 5
      });
      
      if (result.articles.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento",
          articles: [],
          resolvedFilters: {
            product: result.resolvedProduct || args.product,
            subproduct: result.resolvedSubproduct || args.subproduct
          }
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
        resolvedFilters: {
          product: result.resolvedProduct,
          subproduct: result.resolvedSubproduct
        }
      });
    }
  };
}
