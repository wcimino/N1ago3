import { ZendeskArticlesStorage } from "../../../external-sources/zendesk/storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../../../external-sources/zendesk/storage/zendeskArticleStatisticsStorage.js";
import { generateEmbedding as generateZendeskEmbedding, generateEnrichedQueryEmbedding } from "../../../external-sources/zendesk/services/embeddingService.js";
import type { ToolDefinition } from "../openaiApiService.js";

const RELEVANCE_THRESHOLD = 0.05;

export interface ZendeskSearchContext {
  produto?: string;
  subproduto?: string;
  assunto?: string;
  intencao?: string;
  situacao?: string;
}

export function createZendeskKnowledgeBaseTool(searchContext?: ZendeskSearchContext): ToolDefinition {
  return {
    name: "search_knowledge_base_zendesk",
    description: "Busca artigos na base de conhecimento do Zendesk (Help Center) usando busca semântica inteligente. Use para encontrar artigos de ajuda, FAQs e documentação pública. A busca entende o significado da sua consulta e encontra os artigos mais relevantes. Você pode fornecer contexto adicional (produto, subproduto, assunto, intenção) para melhorar a precisão da busca.",
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
          description: "Produto relacionado (ex: Cartão, Conta Digital, Maquinona, Empréstimo). Melhora a precisão da busca."
        },
        subproduto: {
          type: "string",
          description: "Subproduto ou variante (ex: Cartão de Débito, Cartão de Crédito). Melhora a precisão da busca."
        },
        assunto: {
          type: "string",
          description: "Assunto ou tema geral (ex: Saque, Fatura, Limite, Preço e tarifas). Melhora a precisão da busca."
        },
        intencao: {
          type: "string",
          description: "Intenção ou tipo de demanda (ex: Dúvida, Reclamação, Solicitação). Melhora a precisão da busca."
        }
      },
      required: []
    },
    handler: async (args: { keywords?: string; section?: string; produto?: string; subproduto?: string; assunto?: string; intencao?: string }) => {
      let articles: Array<{
        id: number;
        zendeskId: string;
        title: string;
        body: string | null;
        sectionName: string | null;
        htmlUrl: string | null;
        similarity: number;
      }> = [];
      
      const mergedContext = {
        produto: args.produto || searchContext?.produto,
        subproduto: args.subproduto || searchContext?.subproduto,
        assunto: args.assunto || searchContext?.assunto,
        intencao: args.intencao || searchContext?.intencao,
        situacao: searchContext?.situacao,
      };
      
      const hasContext = mergedContext.produto || mergedContext.subproduto || mergedContext.assunto || mergedContext.intencao || mergedContext.situacao;
      
      if (args.keywords && args.keywords.trim().length > 0) {
        const stats = await ZendeskArticlesStorage.getEmbeddingStats();
        
        if (stats.withEmbedding > 0) {
          try {
            let queryEmbedding: number[];
            
            if (hasContext) {
              console.log(`[Zendesk KB Tool] Using enriched query with context: produto=${mergedContext.produto}, subproduto=${mergedContext.subproduto}, assunto=${mergedContext.assunto}, intencao=${mergedContext.intencao}`);
              const enrichedResult = await generateEnrichedQueryEmbedding({
                keywords: args.keywords,
                ...mergedContext,
              });
              queryEmbedding = enrichedResult.embedding;
            } else {
              const simpleResult = await generateZendeskEmbedding(args.keywords);
              queryEmbedding = simpleResult.embedding;
            }
            
            const semanticResults = await ZendeskArticlesStorage.searchBySimilarity(
              queryEmbedding,
              { limit: 5 }
            );
            
            articles = semanticResults.map(a => ({
              id: a.id,
              zendeskId: a.zendeskId,
              title: a.title,
              body: a.body,
              sectionName: a.sectionName,
              htmlUrl: a.htmlUrl,
              similarity: a.similarity,
            }));
            
            console.log(`[Zendesk KB Tool] Semantic search found ${articles.length} articles (enriched=${hasContext})`);
          } catch (error) {
            console.error("[Zendesk KB Tool] Semantic search failed, falling back to full-text:", error);
            const searchResults = await ZendeskArticlesStorage.searchArticlesWithRelevance(
              args.keywords,
              { sectionId: args.section, limit: 10 }
            );
            articles = searchResults
              .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
              .slice(0, 5)
              .map(a => ({
                id: a.id,
                zendeskId: a.zendeskId,
                title: a.title,
                body: a.body,
                sectionName: a.sectionName,
                htmlUrl: a.htmlUrl,
                similarity: Math.round(a.relevanceScore * 100),
              }));
          }
        } else {
          console.log("[Zendesk KB Tool] No embeddings available, using full-text search");
          const searchResults = await ZendeskArticlesStorage.searchArticlesWithRelevance(
            args.keywords,
            { sectionId: args.section, limit: 10 }
          );
          articles = searchResults
            .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
            .slice(0, 5)
            .map(a => ({
              id: a.id,
              zendeskId: a.zendeskId,
              title: a.title,
              body: a.body,
              sectionName: a.sectionName,
              htmlUrl: a.htmlUrl,
              similarity: Math.round(a.relevanceScore * 100),
            }));
        }
      } else {
        const allArticles = await ZendeskArticlesStorage.getAllArticles({
          sectionId: args.section,
          limit: 5
        });
        articles = allArticles.map(a => ({
          id: a.id,
          zendeskId: a.zendeskId,
          title: a.title,
          body: a.body,
          sectionName: a.sectionName,
          htmlUrl: a.htmlUrl,
          similarity: 0,
        }));
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
        body: a.body ? a.body.substring(0, 500) + (a.body.length > 500 ? "..." : "") : null,
        url: a.htmlUrl
      }));
      
      return JSON.stringify({
        message: `Encontrados ${articles.length} artigos mais relevantes do Zendesk (busca semântica)`,
        articles: articleList
      });
    }
  };
}
