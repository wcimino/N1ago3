import { db } from "../../../db.js";
import { knowledgeBase } from "../../../../shared/schema.js";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";

export interface SearchResult {
  article: KnowledgeBaseArticle;
  relevanceScore: number;
  matchedFields: string[];
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
}

export const knowledgeBaseService = {
  async searchByProduct(
    productStandard: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10 } = options;

    const articles = await db.select()
      .from(knowledgeBase)
      .where(ilike(knowledgeBase.productStandard, `%${productStandard}%`))
      .orderBy(desc(knowledgeBase.updatedAt))
      .limit(limit);

    return articles.map(article => ({
      article,
      relevanceScore: article.productStandard?.toLowerCase() === productStandard.toLowerCase() ? 100 : 70,
      matchedFields: ["productStandard"],
    }));
  },

  async searchByCategory(
    category1: string,
    category2?: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10 } = options;

    const conditions = [ilike(knowledgeBase.category1, `%${category1}%`)];
    if (category2) {
      conditions.push(ilike(knowledgeBase.category2, `%${category2}%`));
    }

    const articles = await db.select()
      .from(knowledgeBase)
      .where(and(...conditions))
      .orderBy(desc(knowledgeBase.updatedAt))
      .limit(limit);

    return articles.map(article => {
      const matchedFields = ["category1"];
      let score = 50;
      
      if (article.category1?.toLowerCase() === category1.toLowerCase()) {
        score += 25;
      }
      if (category2 && article.category2?.toLowerCase() === category2.toLowerCase()) {
        score += 25;
        matchedFields.push("category2");
      }

      return { article, relevanceScore: score, matchedFields };
    });
  },

  async searchByKeywords(
    keywords: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, minScore = 0 } = options;

    if (keywords.length === 0) return [];

    const conditions = keywords.flatMap(keyword => [
      ilike(knowledgeBase.description, `%${keyword}%`),
      ilike(knowledgeBase.resolution, `%${keyword}%`),
      ilike(knowledgeBase.observations, `%${keyword}%`),
    ]);

    const articles = await db.select()
      .from(knowledgeBase)
      .where(or(...conditions))
      .orderBy(desc(knowledgeBase.updatedAt))
      .limit(limit * 2);

    const results: SearchResult[] = articles.map(article => {
      const matchedFields: string[] = [];
      let score = 0;

      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (article.description?.toLowerCase().includes(lowerKeyword)) {
          if (!matchedFields.includes("description")) matchedFields.push("description");
          score += 20;
        }
        if (article.resolution?.toLowerCase().includes(lowerKeyword)) {
          if (!matchedFields.includes("resolution")) matchedFields.push("resolution");
          score += 20;
        }
        if (article.observations?.toLowerCase().includes(lowerKeyword)) {
          if (!matchedFields.includes("observations")) matchedFields.push("observations");
          score += 10;
        }
      }

      return { article, relevanceScore: Math.min(score, 100), matchedFields };
    });

    return results
      .filter(r => r.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  },

  async findRelatedArticles(
    product?: string,
    intent?: string,
    descriptionKeywords?: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 5, minScore = 30 } = options;

    const allArticles = await db.select()
      .from(knowledgeBase)
      .orderBy(desc(knowledgeBase.updatedAt));

    const scoredArticles: SearchResult[] = allArticles.map(article => {
      const matchedFields: string[] = [];
      let score = 0;

      if (product && article.productStandard) {
        if (article.productStandard.toLowerCase() === product.toLowerCase()) {
          score += 40;
          matchedFields.push("productStandard");
        } else if (article.productStandard.toLowerCase().includes(product.toLowerCase()) ||
                   product.toLowerCase().includes(article.productStandard.toLowerCase())) {
          score += 20;
          matchedFields.push("productStandard");
        }
      }

      if (intent && article.intent) {
        if (article.intent.toLowerCase() === intent.toLowerCase()) {
          score += 30;
          matchedFields.push("intent");
        } else if (article.intent.toLowerCase().includes(intent.toLowerCase()) ||
                   intent.toLowerCase().includes(article.intent.toLowerCase())) {
          score += 15;
          matchedFields.push("intent");
        }
      }

      if (descriptionKeywords && descriptionKeywords.length > 0) {
        const articleText = `${article.description || ""} ${article.resolution || ""} ${article.observations || ""}`.toLowerCase();
        let keywordMatches = 0;

        for (const keyword of descriptionKeywords) {
          if (keyword.length > 2 && articleText.includes(keyword.toLowerCase())) {
            keywordMatches++;
          }
        }

        if (keywordMatches > 0) {
          const keywordScore = Math.min((keywordMatches / descriptionKeywords.length) * 30, 30);
          score += keywordScore;
          matchedFields.push("keywords");
        }
      }

      return { article, relevanceScore: Math.round(score), matchedFields };
    });

    return scoredArticles
      .filter(r => r.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  },

  async getArticleById(id: number): Promise<KnowledgeBaseArticle | null> {
    const [article] = await db.select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id));
    return article || null;
  },

  async getAllArticles(options: { limit?: number; offset?: number } = {}): Promise<KnowledgeBaseArticle[]> {
    const { limit = 50, offset = 0 } = options;

    return await db.select()
      .from(knowledgeBase)
      .orderBy(desc(knowledgeBase.updatedAt))
      .limit(limit)
      .offset(offset);
  },

  async getArticleCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(knowledgeBase);
    return Number(result[0]?.count || 0);
  },

  formatArticlesForPrompt(results: SearchResult[]): string {
    if (results.length === 0) {
      return "Nenhum artigo relacionado encontrado na base de conhecimento.";
    }

    return results.map((r, i) => {
      const article = r.article;
      return `**Artigo ${i + 1}** (ID: ${article.id}, Relevância: ${r.relevanceScore}%)
- Produto: ${article.productStandard || "N/A"}
- Categoria: ${article.category1 || "N/A"}${article.category2 ? ` / ${article.category2}` : ""}
- Descrição: ${article.description || "N/A"}
- Resolução: ${article.resolution || "N/A"}
- Observações: ${article.observations || "N/A"}`;
    }).join("\n\n");
  },
};
