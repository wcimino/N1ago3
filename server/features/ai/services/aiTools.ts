import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { ZendeskArticlesStorage } from "../../zendesk-articles/storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../../zendesk-articles/storage/zendeskArticleStatisticsStorage.js";
import { knowledgeSubjectsStorage } from "../../knowledge/storage/knowledgeSubjectsStorage.js";
import { knowledgeIntentsStorage } from "../../knowledge/storage/knowledgeIntentsStorage.js";
import type { ToolDefinition } from "./openaiApiService.js";

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

      const articles = await knowledgeBaseStorage.getAllArticles({
        productStandard: args.product,
        subjectId: subjectId,
        intentId: intentId,
        search: args.keywords
      });
      
      const limitedArticles = articles.slice(0, 5);
      
      if (limitedArticles.length === 0) {
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
      
      const articleList = limitedArticles.map(a => ({
        product: a.productStandard,
        subproduct: a.subproductStandard,
        subject: resolvedSubject,
        intent: resolvedIntent || a.intent,
        description: a.description,
        resolution: a.resolution
      }));
      
      return JSON.stringify({
        message: `Encontrados ${limitedArticles.length} artigos relevantes`,
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
    description: "Busca artigos na base de conhecimento do Zendesk (Help Center). Use para encontrar artigos de ajuda, FAQs e documentação pública.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Palavras-chave para buscar no título e conteúdo dos artigos"
        },
        section: {
          type: "string",
          description: "ID da seção para filtrar artigos (opcional)"
        }
      },
      required: []
    },
    handler: async (args: { keywords?: string; section?: string }) => {
      const articles = await ZendeskArticlesStorage.getAllArticles({
        search: args.keywords,
        sectionId: args.section,
        limit: 5
      });
      
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
        id: String(a.id),
        title: a.title,
        section: a.sectionName,
        body: a.body ? a.body.substring(0, 500) + (a.body.length > 500 ? "..." : "") : null,
        url: a.htmlUrl
      }));
      
      return JSON.stringify({
        message: `Encontrados ${articles.length} artigos do Zendesk`,
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
