import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import { knowledgeSubjectsStorage } from "../../../knowledge/storage/knowledgeSubjectsStorage.js";
import { knowledgeIntentsStorage } from "../../../knowledge/storage/knowledgeIntentsStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";

export function createSubjectIntentTool(): ToolDefinition {
  return {
    name: "search_subject_and_intent",
    description: "Busca assuntos e intenções válidos na base de conhecimento. Use para encontrar os assuntos disponíveis para um produto e as intenções disponíveis para um assunto.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Nome do produto para filtrar assuntos (ex: 'Conta Digital', 'Cartão de Crédito'). Se informado, retorna os assuntos disponíveis para esse produto."
        },
        subject: {
          type: "string",
          description: "Nome ou sinônimo do assunto para buscar intenções (ex: 'fatura', 'pagamento'). Se informado, retorna as intenções disponíveis para esse assunto."
        }
      },
      required: []
    },
    handler: async (args: { product?: string; subject?: string }) => {
      const result: {
        message: string;
        subjects?: Array<{ id: number; name: string; synonyms: string[] }>;
        intents?: Array<{ id: number; name: string; synonyms: string[] }>;
        resolvedSubject?: { id: number; name: string } | null;
      } = {
        message: ""
      };

      if (args.product) {
        const products = await productCatalogStorage.getAll();
        const matchedProduct = products.find(p => 
          p.fullName.toLowerCase().includes(args.product!.toLowerCase()) ||
          p.produto.toLowerCase().includes(args.product!.toLowerCase())
        );

        if (matchedProduct) {
          const subjects = await knowledgeSubjectsStorage.getByProductCatalogId(matchedProduct.id);
          result.subjects = subjects.map(s => ({
            id: s.id,
            name: s.name,
            synonyms: s.synonyms || []
          }));
          result.message = `Encontrados ${subjects.length} assuntos para o produto '${matchedProduct.fullName}'`;
        } else {
          const allSubjects = await knowledgeSubjectsStorage.getAll();
          result.subjects = allSubjects.map(s => ({
            id: s.id,
            name: s.name,
            synonyms: s.synonyms || []
          }));
          result.message = `Produto '${args.product}' não encontrado. Listando todos os ${allSubjects.length} assuntos disponíveis.`;
        }
      }

      if (args.subject) {
        const subjects = await knowledgeSubjectsStorage.findByNameOrSynonym(args.subject);
        
        if (subjects.length > 0) {
          const matchedSubject = subjects[0];
          result.resolvedSubject = { id: matchedSubject.id, name: matchedSubject.name };
          
          const intents = await knowledgeIntentsStorage.getBySubjectId(matchedSubject.id);
          result.intents = intents.map(i => ({
            id: i.id,
            name: i.name,
            synonyms: i.synonyms || []
          }));
          
          const intentMsg = `Encontradas ${intents.length} intenções para o assunto '${matchedSubject.name}'`;
          result.message = result.message ? `${result.message}. ${intentMsg}` : intentMsg;
        } else {
          result.resolvedSubject = null;
          result.message = result.message 
            ? `${result.message}. Assunto '${args.subject}' não encontrado.`
            : `Assunto '${args.subject}' não encontrado.`;
        }
      }

      if (!args.product && !args.subject) {
        const allSubjects = await knowledgeSubjectsStorage.getAll();
        result.subjects = allSubjects.map(s => ({
          id: s.id,
          name: s.name,
          synonyms: s.synonyms || []
        }));
        result.message = `Listando todos os ${allSubjects.length} assuntos disponíveis. Informe um produto para filtrar ou um assunto para ver as intenções.`;
      }

      return JSON.stringify(result);
    }
  };
}
