import { 
  searchObjectiveProblems, 
  searchObjectiveProblemsBySimilarity,
  hasObjectiveProblemEmbeddings,
  type ObjectiveProblemSearchResult,
  type SemanticSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import { generateEmbedding } from "../../../../shared/embeddings/index.js";
import type { ToolDefinition } from "../openaiApiService.js";

export function createProblemObjectiveTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_problem_objective",
    description: "Busca problemas objetivos na base de conhecimento para identificar o problema real do cliente. Retorna uma lista de problemas com % de similaridade semântica.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Nome do produto (obrigatório). Ex: 'Cartão de Crédito', 'Conta Digital'"
        },
        subproduct: {
          type: "string",
          description: "Nome do subproduto para filtrar (ex: 'Gold', 'Platinum')"
        },
        keywords: {
          type: "string",
          description: "Descrição do problema do cliente para busca semântica (ex: 'cliente não consegue pagar com o cartão', 'cobrança apareceu duas vezes')"
        }
      },
      required: ["product"]
    },
    handler: async (args: { product: string; subproduct?: string; keywords?: string }) => {
      let productId: number | undefined;
      let resolvedProduct: string | null = null;
      let resolvedSubproduct: string | null = null;

      if (args.product) {
        const resolved = await productCatalogStorage.resolveProductId(args.product, args.subproduct);
        if (resolved) {
          productId = resolved.id;
          resolvedProduct = resolved.produto;
          resolvedSubproduct = resolved.subproduto;
        }
      }

      const hasEmbeddings = await hasObjectiveProblemEmbeddings();
      
      if (args.keywords && hasEmbeddings) {
        console.log(`[ProblemObjectiveTool] Using semantic search for: "${args.keywords}"`);
        
        const { embedding, logId, tokensUsed } = await generateEmbedding(args.keywords, { 
          contextType: "query" 
        });
        
        console.log(`[ProblemObjectiveTool] Embedding generated, logId: ${logId}, tokens: ${tokensUsed}`);
        
        const semanticResults = await searchObjectiveProblemsBySimilarity({
          queryEmbedding: embedding,
          productId,
          onlyActive: true,
          limit: 10,
        });

        if (semanticResults.length === 0) {
          return JSON.stringify({
            message: "Nenhum problema objetivo encontrado" + (args.product ? ` para o produto '${args.product}'` : ""),
            problems: []
          });
        }

        const problemList = semanticResults.map((p: SemanticSearchResult) => ({
          source: "problem" as const,
          id: p.id,
          name: p.name,
          matchScore: p.similarity,
          matchReason: `Similaridade semântica: ${p.similarity}%`,
          description: p.description,
          synonyms: p.synonyms,
          examples: p.examples,
          products: p.productNames,
        }));

        return JSON.stringify({
          message: `Encontrados ${semanticResults.length} problemas objetivos (busca semântica)`,
          problems: problemList
        });
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
        source: "problem" as const,
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
