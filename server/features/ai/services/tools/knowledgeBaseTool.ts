import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import type { ToolDefinition } from "../openaiApiService.js";

export function createKnowledgeBaseArticlesTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_articles",
    description: "Busca artigos na base de conhecimento. Use para encontrar informações sobre produtos, procedimentos e resoluções de problemas.",
    parameters: {
      type: "object",
      properties: {
        conversationContext: {
          type: "string",
          description: "Resumo ou contexto da conversa para busca semântica principal (obrigatório). A busca usa o contexto para encontrar artigos semanticamente relevantes."
        },
        product: {
          type: "string",
          description: "Nome do produto (obrigatório). Ex: 'Cartão de Crédito', 'Conta Digital'"
        },
        subproduct: {
          type: "string",
          description: "Nome do subproduto (opcional). Ex: 'Gold', 'Platinum'"
        },
        keywords: {
          type: "string",
          description: "Palavras-chave opcionais para filtrar/priorizar os resultados. Usado como boost sobre os resultados semânticos."
        }
      },
      required: ["conversationContext", "product"]
    },
    handler: async (args: { product: string; subproduct?: string; conversationContext?: string; keywords?: string }) => {
      const productContext = args.subproduct 
        ? `${args.product} > ${args.subproduct}`
        : args.product;
      
      console.log(`[KnowledgeBaseTool] Called with product="${args.product}", subproduct="${args.subproduct || 'none'}", productContext="${productContext}"`);
      
      const result = await runKnowledgeBaseSearch({
        productContext,
        conversationContext: args.conversationContext,
        keywords: args.keywords,
        limit: 5
      });
      
      if (result.articles.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento",
          articles: [],
          product: productContext
        });
      }
      
      const articleList = result.articles.map((a) => ({
        source: "article" as const,
        question: a.question,
        answer: a.answer,
        keywords: a.keywords,
        relevance: `${Math.round(a.relevanceScore)}%`,
        matched_terms: a.matchedTerms || []
      }));
      
      return JSON.stringify({
        message: `Encontrados ${result.articles.length} artigos relevantes`,
        articles: articleList,
        product: productContext
      });
    }
  };
}
