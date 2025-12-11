import { knowledgeIntentsStorage } from "../../../knowledge/storage/knowledgeIntentsStorage.js";
import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import type { ToolDefinition } from "../openaiApiService.js";

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
      const result = await runKnowledgeBaseSearch({
        product: args.product,
        subject: args.subject,
        intent: args.intent,
        keywords: args.keywords,
        limit: 5
      });
      
      if (result.articles.length === 0) {
        const synonymInfo: string[] = [];
        if (args.subject && result.resolvedSubject && args.subject.toLowerCase() !== result.resolvedSubject.toLowerCase()) {
          synonymInfo.push(`assunto '${args.subject}' resolvido para '${result.resolvedSubject}'`);
        }
        if (args.intent && result.resolvedIntent && args.intent.toLowerCase() !== result.resolvedIntent.toLowerCase()) {
          synonymInfo.push(`intenção '${args.intent}' resolvido para '${result.resolvedIntent}'`);
        }
        
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento" + (synonymInfo.length > 0 ? ` (${synonymInfo.join(', ')})` : ""),
          articles: [],
          resolvedFilters: {
            subject: result.resolvedSubject || args.subject,
            intent: result.resolvedIntent || args.intent
          }
        });
      }
      
      const articleList = await Promise.all(result.articles.map(async (a) => {
        let intentName = result.resolvedIntent;
        if (!intentName && a.intentId) {
          const intent = await knowledgeIntentsStorage.getById(a.intentId);
          if (intent) {
            intentName = intent.name;
          }
        }
        return {
          product: a.productStandard,
          subproduct: a.subproductStandard,
          subject: result.resolvedSubject,
          intent: intentName || null,
          description: a.description,
          resolution: a.resolution,
          relevance: a.relevanceScore.toFixed(2)
        };
      }));
      
      return JSON.stringify({
        message: `Encontrados ${result.articles.length} artigos relevantes`,
        articles: articleList,
        resolvedFilters: {
          subject: result.resolvedSubject,
          intent: result.resolvedIntent
        }
      });
    }
  };
}
