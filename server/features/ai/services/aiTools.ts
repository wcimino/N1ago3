import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "./openaiApiService.js";

export function createKnowledgeBaseTool(): ToolDefinition {
  return {
    name: "search_knowledge_base",
    description: "Busca artigos na base de conhecimento. Use para encontrar informações sobre produtos, procedimentos e resoluções de problemas.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Nome do produto para filtrar (ex: 'Conta Digital', 'Cartão de Crédito')"
        },
        intent: {
          type: "string",
          enum: ["suporte", "contratar"],
          description: "Intenção do cliente: 'suporte' ou 'contratar'"
        },
        keywords: {
          type: "string",
          description: "Palavras-chave para buscar no conteúdo dos artigos"
        }
      },
      required: []
    },
    handler: async (args: { product?: string; intent?: string; keywords?: string }) => {
      const articles = await knowledgeBaseStorage.getAllArticles({
        productStandard: args.product,
        intent: args.intent,
        search: args.keywords
      });
      
      const limitedArticles = articles.slice(0, 5);
      
      if (limitedArticles.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum artigo encontrado na base de conhecimento",
          articles: [] 
        });
      }
      
      const articleList = limitedArticles.map(a => ({
        product: a.productStandard,
        subproduct: a.subproductStandard,
        intent: a.intent,
        description: a.description,
        resolution: a.resolution
      }));
      
      return JSON.stringify({
        message: `Encontrados ${limitedArticles.length} artigos relevantes`,
        articles: articleList
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
          (p.categoria1 && p.categoria1.toLowerCase().includes(query)) ||
          (p.categoria2 && p.categoria2.toLowerCase().includes(query)) ||
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
        subproduto: p.subproduto,
        categoria1: p.categoria1,
        categoria2: p.categoria2
      }));
      
      return JSON.stringify({
        message: `Encontrados ${products.length} produtos no catálogo`,
        products: productList
      });
    }
  };
}

export interface ToolFlags {
  useKnowledgeBaseTool?: boolean;
  useProductCatalogTool?: boolean;
}

export function buildToolsFromFlags(flags: ToolFlags): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (flags.useKnowledgeBaseTool) {
    tools.push(createKnowledgeBaseTool());
  }
  
  if (flags.useProductCatalogTool) {
    tools.push(createProductCatalogTool());
  }
  
  return tools;
}
