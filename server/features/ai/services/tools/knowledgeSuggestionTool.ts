import type { ToolDefinition } from "../openaiApiService.js";

export function createKnowledgeSuggestionTool(): ToolDefinition {
  return {
    name: "create_knowledge_suggestion",
    description: "Cria uma sugestão de conhecimento. Use após analisar os artigos existentes e buscar no catálogo de produtos.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "skip"],
          description: "Ação a tomar: create (novo artigo), update (atualizar existente), skip (ignorar)"
        },
        targetArticleId: {
          type: "number",
          description: "ID do artigo a atualizar (obrigatório se action=update)"
        },
        updateReason: {
          type: "string",
          description: "Motivo da atualização (obrigatório se action=update)"
        },
        name: {
          type: "string",
          description: "Nome curto e descritivo do artigo"
        },
        productStandard: {
          type: "string",
          description: "Produto principal (use valor do catálogo)"
        },
        subproductStandard: {
          type: "string",
          description: "Subproduto específico (use valor do catálogo)"
        },
        description: {
          type: "string",
          description: "Descrição do problema/situação"
        },
        resolution: {
          type: "string",
          description: "Solução detalhada com passos específicos. Use verbos no infinitivo."
        },
        observations: {
          type: "string",
          description: "Observações adicionais, exceções, casos especiais"
        },
        confidenceScore: {
          type: "number",
          description: "Nível de confiança de 0 a 100"
        },
        skipReason: {
          type: "string",
          description: "Motivo para ignorar (obrigatório se action=skip)"
        }
      },
      required: ["action"]
    },
    handler: async (args: {
      action: "create" | "update" | "skip";
      targetArticleId?: number;
      updateReason?: string;
      name?: string;
      productStandard?: string;
      subproductStandard?: string;
      description?: string;
      resolution?: string;
      observations?: string;
      confidenceScore?: number;
      skipReason?: string;
    }) => {
      return JSON.stringify({
        message: `Sugestão registrada: action=${args.action}`,
        action: args.action,
        targetArticleId: args.targetArticleId,
        name: args.name,
        productStandard: args.productStandard,
        subproductStandard: args.subproductStandard,
        description: args.description,
        resolution: args.resolution,
        observations: args.observations,
        confidenceScore: args.confidenceScore,
        skipReason: args.skipReason,
        updateReason: args.updateReason
      });
    }
  };
}
