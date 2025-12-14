import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import { knowledgeSubjectsStorage } from "../../../knowledge/storage/knowledgeSubjectsStorage.js";
import { knowledgeIntentsStorage } from "../../../knowledge/storage/knowledgeIntentsStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";

export interface SubjectSearchResult {
  id: number;
  name: string;
  synonyms: string[];
  matchScore: number;
  matchReason: string;
}

export interface IntentSearchResult {
  id: number;
  name: string;
  synonyms: string[];
  matchScore: number;
  matchReason: string;
}

export interface SubjectIntentSearchResponse {
  message: string;
  subjects?: SubjectSearchResult[];
  intents?: IntentSearchResult[];
  resolvedProduct?: { id: number; name: string } | null;
  resolvedSubject?: { id: number; name: string } | null;
}

function calculateTextMatchScore(searchTerm: string, name: string, synonyms: string[]): { score: number; reason: string } {
  const searchLower = searchTerm.toLowerCase().trim();
  const nameLower = name.toLowerCase();
  
  if (nameLower === searchLower) {
    return { score: 100, reason: "Match exato no nome" };
  }
  
  const synonymMatch = synonyms.find(s => s.toLowerCase() === searchLower);
  if (synonymMatch) {
    return { score: 95, reason: `Match exato no sinônimo: ${synonymMatch}` };
  }
  
  if (nameLower.includes(searchLower)) {
    return { score: 80, reason: "Nome contém o termo buscado" };
  }
  
  const partialSynonym = synonyms.find(s => s.toLowerCase().includes(searchLower));
  if (partialSynonym) {
    return { score: 70, reason: `Sinônimo contém o termo: ${partialSynonym}` };
  }
  
  if (searchLower.includes(nameLower)) {
    return { score: 60, reason: "Termo buscado contém o nome" };
  }
  
  const words = searchLower.split(/\s+/);
  const matchedWords = words.filter(w => 
    nameLower.includes(w) || synonyms.some(s => s.toLowerCase().includes(w))
  );
  
  if (matchedWords.length > 0) {
    const score = Math.round(50 * (matchedWords.length / words.length));
    return { score, reason: `Match parcial: ${matchedWords.join(", ")}` };
  }
  
  return { score: 0, reason: "Sem match" };
}

export async function runSubjectIntentSearch(params: {
  product?: string;
  subproduct?: string;
  subject?: string;
  keywords?: string;
}): Promise<SubjectIntentSearchResponse> {
  const result: SubjectIntentSearchResponse = {
    message: ""
  };

  let productId: number | undefined;
  
  if (params.product) {
    const resolved = await productCatalogStorage.resolveProductId(params.product, params.subproduct);
    
    if (resolved) {
      productId = resolved.id;
      const productName = resolved.subproduto 
        ? `${resolved.produto} ${resolved.subproduto}` 
        : resolved.produto;
      result.resolvedProduct = { id: resolved.id, name: productName };
    } else {
      result.message = `Produto '${params.product}' não encontrado.`;
    }
  }

  if (productId || !params.product) {
    const subjects = productId 
      ? await knowledgeSubjectsStorage.getByProductCatalogId(productId)
      : await knowledgeSubjectsStorage.getAll();
    
    const searchTerm = params.keywords || params.subject;
    
    if (searchTerm) {
      const scoredSubjects = subjects
        .map(s => {
          const { score, reason } = calculateTextMatchScore(searchTerm, s.name, s.synonyms || []);
          return {
            id: s.id,
            name: s.name,
            synonyms: s.synonyms || [],
            matchScore: score,
            matchReason: reason
          };
        })
        .filter(s => s.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
      
      result.subjects = scoredSubjects;
      
      if (scoredSubjects.length > 0) {
        const productInfo = result.resolvedProduct ? ` para '${result.resolvedProduct.name}'` : "";
        result.message = `Encontrados ${scoredSubjects.length} assuntos${productInfo} (busca: "${searchTerm}")`;
      } else {
        result.message = result.message || `Nenhum assunto encontrado para "${searchTerm}"`;
      }
    } else {
      result.subjects = subjects.map(s => ({
        id: s.id,
        name: s.name,
        synonyms: s.synonyms || [],
        matchScore: 100,
        matchReason: "Listagem completa"
      }));
      
      const productInfo = result.resolvedProduct ? ` para '${result.resolvedProduct.name}'` : "";
      result.message = `Listando ${subjects.length} assuntos disponíveis${productInfo}`;
    }
  }

  const subjectToSearch = params.subject || (result.subjects && result.subjects.length > 0 && result.subjects[0].matchScore >= 70 
    ? result.subjects[0].name 
    : undefined);
  
  if (subjectToSearch) {
    const matchedSubjects = await knowledgeSubjectsStorage.findByNameOrSynonym(subjectToSearch);
    
    if (matchedSubjects.length > 0) {
      const matchedSubject = matchedSubjects[0];
      result.resolvedSubject = { id: matchedSubject.id, name: matchedSubject.name };
      
      const intents = await knowledgeIntentsStorage.getBySubjectId(matchedSubject.id);
      
      if (params.keywords) {
        const scoredIntents = intents
          .map(i => {
            const { score, reason } = calculateTextMatchScore(params.keywords!, i.name, i.synonyms || []);
            return {
              id: i.id,
              name: i.name,
              synonyms: i.synonyms || [],
              matchScore: score,
              matchReason: reason
            };
          })
          .filter(i => i.matchScore > 0)
          .sort((a, b) => b.matchScore - a.matchScore);
        
        result.intents = scoredIntents;
        
        const intentMsg = scoredIntents.length > 0
          ? `Encontradas ${scoredIntents.length} intenções para '${matchedSubject.name}'`
          : `Nenhuma intenção encontrada para "${params.keywords}" no assunto '${matchedSubject.name}'`;
        
        result.message = result.message ? `${result.message}. ${intentMsg}` : intentMsg;
      } else {
        result.intents = intents.map(i => ({
          id: i.id,
          name: i.name,
          synonyms: i.synonyms || [],
          matchScore: 100,
          matchReason: "Listagem completa"
        }));
        
        const intentMsg = `Encontradas ${intents.length} intenções para '${matchedSubject.name}'`;
        result.message = result.message ? `${result.message}. ${intentMsg}` : intentMsg;
      }
    }
  }

  if (!result.message) {
    result.message = "Informe um produto para ver assuntos ou um assunto para ver intenções.";
  }

  return result;
}

export function createSubjectIntentTool(): ToolDefinition {
  return {
    name: "search_subject_and_intent",
    description: "Busca assuntos e intenções na base de conhecimento para categorizar o atendimento. Use para encontrar os assuntos disponíveis para um produto e as intenções disponíveis para um assunto.",
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
        subject: {
          type: "string",
          description: "Nome ou sinônimo do assunto para buscar intenções (ex: 'fatura', 'pagamento')"
        },
        keywords: {
          type: "string",
          description: "Descrição do cliente para busca textual em assuntos e intenções"
        }
      },
      required: ["product"]
    },
    handler: async (args: { product: string; subproduct?: string; subject?: string; keywords?: string }) => {
      const result = await runSubjectIntentSearch({
        product: args.product,
        subproduct: args.subproduct,
        subject: args.subject,
        keywords: args.keywords
      });
      return JSON.stringify(result);
    }
  };
}
