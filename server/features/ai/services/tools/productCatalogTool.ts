import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";

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
