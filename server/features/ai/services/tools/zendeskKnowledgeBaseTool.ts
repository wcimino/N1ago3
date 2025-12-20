import { ZendeskArticlesStorage } from "../../../external-sources/zendesk/storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../../../external-sources/zendesk/storage/zendeskArticleStatisticsStorage.js";
import { generateEmbedding as generateZendeskEmbedding, generateEnrichedQueryEmbedding } from "../../../external-sources/zendesk/services/embeddingService.js";
import type { ToolDefinition } from "../openaiApiService.js";

const MAX_PRODUCT_MISMATCH_PENALTY = 0.20;
const MOVILE_PAY_SUBDOMAIN_PENALTY = 0.20;

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function tokenize(text: string): string[] {
  return normalizeForComparison(text)
    .split(/[\s\-_]+/)
    .filter(token => token.length > 1);
}

function calculateProductMatchScore(sectionName: string | null, produto: string | undefined): number {
  if (!sectionName || !produto) return 1;
  
  const normalizedSection = normalizeForComparison(sectionName);
  const normalizedProduct = normalizeForComparison(produto);
  
  if (normalizedSection.includes(normalizedProduct) || normalizedProduct.includes(normalizedSection)) {
    return 1;
  }
  
  const sectionTokens = tokenize(sectionName);
  const productTokens = tokenize(produto);
  
  if (sectionTokens.length === 0 || productTokens.length === 0) {
    return levenshteinSimilarity(normalizedSection, normalizedProduct);
  }
  
  let totalScore = 0;
  let matchCount = 0;
  
  for (const productToken of productTokens) {
    let bestTokenScore = 0;
    
    for (const sectionToken of sectionTokens) {
      if (sectionToken.includes(productToken) || productToken.includes(sectionToken)) {
        bestTokenScore = 1;
        break;
      }
      
      const similarity = levenshteinSimilarity(sectionToken, productToken);
      if (similarity > bestTokenScore) {
        bestTokenScore = similarity;
      }
    }
    
    if (bestTokenScore >= 0.7) {
      matchCount++;
    }
    totalScore += bestTokenScore;
  }
  
  const avgScore = totalScore / productTokens.length;
  const matchRatio = matchCount / productTokens.length;
  
  const finalScore = (avgScore * 0.6) + (matchRatio * 0.4);
  
  return Math.min(1, Math.max(0, finalScore));
}

function applyProductMismatchPenalty<T extends { similarity: number; sectionName: string | null }>(
  articles: T[],
  produto: string | undefined
): T[] {
  if (!produto) return articles;
  
  return articles
    .map(article => {
      const matchScore = calculateProductMatchScore(article.sectionName, produto);
      
      if (matchScore < 1) {
        const penaltyFactor = (1 - matchScore) * MAX_PRODUCT_MISMATCH_PENALTY;
        const penalizedSimilarity = Math.max(0, article.similarity * (1 - penaltyFactor));
        console.log(`[Zendesk KB Tool] Product match score: "${article.sectionName}" vs "${produto}" = ${matchScore.toFixed(2)} - penalty ${(penaltyFactor * 100).toFixed(1)}% - score ${article.similarity.toFixed(2)} -> ${penalizedSimilarity.toFixed(2)}`);
        return { ...article, similarity: penalizedSimilarity };
      }
      return article;
    })
    .sort((a, b) => b.similarity - a.similarity);
}

function applySubdomainPenalty<T extends { similarity: number; helpCenterSubdomain: string | null }>(
  articles: T[]
): T[] {
  return articles
    .map(article => {
      const subdomain = article.helpCenterSubdomain?.toLowerCase() || '';
      const isMovilePay = subdomain.includes('movile') || subdomain.includes('movilepay');
      if (isMovilePay) {
        const penalizedSimilarity = Math.max(0, article.similarity * (1 - MOVILE_PAY_SUBDOMAIN_PENALTY));
        console.log(`[Zendesk KB Tool] Movile Pay subdomain penalty applied: "${article.helpCenterSubdomain}" - score ${article.similarity.toFixed(2)} -> ${penalizedSimilarity.toFixed(2)}`);
        return { ...article, similarity: penalizedSimilarity };
      }
      return article;
    })
    .sort((a, b) => b.similarity - a.similarity);
}

export interface ZendeskSearchContext {
  // Campos usados APENAS para penalidades (não entram no embedding)
  produto?: string;
  // Campos usados para gerar o embedding de busca
  question?: string;
  keywords?: string;
}

export function createZendeskKnowledgeBaseTool(searchContext?: ZendeskSearchContext): ToolDefinition {
  return {
    name: "search_knowledge_base_zendesk",
    description: "Busca artigos na base de conhecimento do Zendesk (Help Center) usando busca semântica inteligente. Use para encontrar artigos de ajuda, FAQs e documentação pública. A busca entende o significado da sua consulta e encontra os artigos mais relevantes. Você pode fornecer intenção para melhorar a busca e produto para penalizar artigos de outros produtos.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Descreva o que você está buscando. Pode ser uma pergunta, palavras-chave ou uma frase descrevendo o problema/tema."
        },
        section: {
          type: "string",
          description: "ID da seção para filtrar artigos (opcional)"
        },
        produto: {
          type: "string",
          description: "Produto relacionado (ex: Cartão, Conta Digital, Maquinona, Empréstimo). Usado para penalizar artigos de produtos diferentes no ranking."
        },
        intencao: {
          type: "string",
          description: "Intenção ou tipo de demanda (ex: Cancelar cartão, Desbloquear conta). Usado para melhorar a busca semântica."
        }
      },
      required: []
    },
    handler: async (args: { keywords?: string; section?: string; produto?: string; intencao?: string }) => {
      let articles: Array<{
        id: number;
        zendeskId: string;
        helpCenterSubdomain: string | null;
        title: string;
        body: string | null;
        sectionName: string | null;
        htmlUrl: string | null;
        similarity: number;
      }> = [];
      
      // Contexto para EMBEDDING (apenas question e keywords do artigo)
      const embeddingContext = {
        question: searchContext?.question,
        articleKeywords: searchContext?.keywords,
      };
      
      // Contexto para PENALIDADES (produto)
      const penaltyContext = {
        produto: args.produto || searchContext?.produto,
      };
      
      const hasEmbeddingContext = embeddingContext.question || embeddingContext.articleKeywords;
      
      if (args.keywords && args.keywords.trim().length > 0) {
        const stats = await ZendeskArticlesStorage.getEmbeddingStats();
        
        if (stats.withEmbedding > 0) {
          try {
            let queryEmbedding: number[];
            
            if (hasEmbeddingContext) {
              console.log(`[Zendesk KB Tool] Using enriched query with context: question=${embeddingContext.question}, keywords=${embeddingContext.articleKeywords} (produto=${penaltyContext.produto} for penalties only)`);
              const enrichedResult = await generateEnrichedQueryEmbedding({
                keywords: args.keywords,
                question: embeddingContext.question,
                articleKeywords: embeddingContext.articleKeywords,
              });
              queryEmbedding = enrichedResult.embedding;
            } else {
              const simpleResult = await generateZendeskEmbedding(args.keywords);
              queryEmbedding = simpleResult.embedding;
            }
            
            const semanticResults = await ZendeskArticlesStorage.searchBySimilarity(
              queryEmbedding,
              { limit: 10 }
            );
            
            const mappedArticles = semanticResults.map(a => ({
              id: a.id,
              zendeskId: a.zendeskId,
              helpCenterSubdomain: a.helpCenterSubdomain,
              title: a.title,
              body: a.body,
              sectionName: a.sectionName,
              htmlUrl: a.htmlUrl,
              similarity: a.similarity,
            }));
            
            let penalizedArticles = applySubdomainPenalty(mappedArticles);
            penalizedArticles = applyProductMismatchPenalty(penalizedArticles, penaltyContext.produto);
            articles = penalizedArticles.slice(0, 5);
            
            console.log(`[Zendesk KB Tool] Semantic search found ${articles.length} articles (enriched=${hasEmbeddingContext}, product penalty applied for: ${penaltyContext.produto || 'none'})`);
          } catch (error) {
            console.error("[Zendesk KB Tool] Semantic search failed:", error);
          }
        } else {
          console.log("[Zendesk KB Tool] No embeddings available - semantic search requires embeddings to be generated first");
        }
      } else {
        const allArticles = await ZendeskArticlesStorage.getAllArticles({
          sectionId: args.section,
          limit: 10
        });
        const mappedAll = allArticles.map(a => ({
          id: a.id,
          zendeskId: a.zendeskId,
          helpCenterSubdomain: a.helpCenterSubdomain,
          title: a.title,
          body: a.body,
          sectionName: a.sectionName,
          htmlUrl: a.htmlUrl,
          similarity: 0,
        }));
        articles = applySubdomainPenalty(mappedAll).slice(0, 5);
      }
      
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
        id: a.zendeskId,
        internalId: a.id,
        title: a.title,
        section: a.sectionName,
        relevance: a.similarity,
        body: a.body ? a.body.substring(0, 1000) + (a.body.length > 1000 ? "..." : "") : null,
        url: a.htmlUrl
      }));
      
      return JSON.stringify({
        message: `Encontrados ${articles.length} artigos mais relevantes do Zendesk (busca semântica)`,
        articles: articleList
      });
    }
  };
}
