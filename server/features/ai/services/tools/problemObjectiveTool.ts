import { 
  searchObjectiveProblems, 
  type ObjectiveProblemSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";

export function createProblemObjectiveTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_problem_objective",
    description: "Busca problemas objetivos na base de conhecimento. Use para identificar qual é o problema real do cliente baseado no que ele descreve. Retorna uma lista de problemas com % de probabilidade de match.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Palavras-chave para buscar (ex: 'cobrança indevida', 'cancelar pedido'). Busca em nome, sinônimos, exemplos e descrição."
        },
        product: {
          type: "string",
          description: "Nome do produto para filtrar (ex: 'Cartão de Crédito', 'Conta Digital')"
        }
      },
      required: []
    },
    handler: async (args: { keywords?: string; product?: string }) => {
      let productId: number | undefined;

      if (args.product) {
        const products = await productCatalogStorage.getAll();
        const matchedProduct = products.find(p =>
          p.fullName.toLowerCase().includes(args.product!.toLowerCase()) ||
          p.produto.toLowerCase().includes(args.product!.toLowerCase())
        );
        if (matchedProduct) {
          productId = matchedProduct.id;
        }
      }

      const results = await searchObjectiveProblems({
        keywords: args.keywords,
        productId,
        onlyActive: true,
        limit: 10,
      });

      if (results.length === 0) {
        return JSON.stringify({
          message: "Nenhum problema objetivo encontrado" + (args.product ? ` para o produto '${args.product}'` : ""),
          problems: []
        });
      }

      const problemList = results.map((p: ObjectiveProblemSearchResult) => ({
        id: p.id,
        name: p.name,
        matchScore: p.matchScore,
        matchReason: p.matchReason,
        description: p.description,
        synonyms: p.synonyms,
        examples: p.examples,
        products: p.productNames,
      }));

      return JSON.stringify({
        message: `Encontrados ${results.length} problemas objetivos`,
        problems: problemList
      });
    }
  };
}
