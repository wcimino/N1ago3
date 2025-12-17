import { db } from "../../../db.js";
import { knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, ilike, or, and, sql, type SQL } from "drizzle-orm";
import { calculateMatchScore, parseSearchTerms, type MatchField } from "../../../shared/utils/matchScoring.js";
import type { SearchArticleResult, SemanticSearchResult } from "./knowledgeBaseTypes.js";

export const knowledgeBaseSearch = {
  async searchArticlesWithRelevance(
    keywords: string,
    options: {
      productId?: number;
      subjectId?: number;
      intentId?: number;
      limit?: number;
      onlyActive?: boolean;
    } = {}
  ): Promise<SearchArticleResult[]> {
    const { productId, subjectId, intentId, limit = 5, onlyActive = false } = options;
    const searchTerms = parseSearchTerms(keywords);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    const conditions: SQL[] = [];
    
    if (onlyActive) {
      conditions.push(eq(knowledgeBase.isActive, true));
    }
    
    if (productId) {
      conditions.push(eq(knowledgeBase.productId, productId));
    }
    if (subjectId) {
      conditions.push(eq(knowledgeBase.subjectId, subjectId));
    }
    if (intentId) {
      conditions.push(eq(knowledgeBase.intentId, intentId));
    }
    
    const likeConditions = searchTerms.slice(0, 3).flatMap(term => [
      ilike(knowledgeBase.question, `%${term}%`),
      ilike(knowledgeBase.answer, `%${term}%`),
      ilike(knowledgeBase.keywords, `%${term}%`)
    ]).filter((c): c is SQL => c !== undefined);
    
    if (likeConditions.length > 0) {
      conditions.push(or(...likeConditions)!);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const articles = await db
      .select()
      .from(knowledgeBase)
      .where(whereClause)
      .orderBy(desc(knowledgeBase.updatedAt));
    
    const scoredResults = articles.map(article => {
      const fields: MatchField[] = [
        { name: "Pergunta", value: article.question || "", weight: 'contains_name' },
        { name: "Resposta", value: article.answer || "", weight: 'contains_secondary' },
        { name: "Keywords", value: article.keywords || "", weight: 'contains_tertiary' },
      ];
      
      const scoreResult = calculateMatchScore(fields, searchTerms);
      
      return {
        ...article,
        relevanceScore: scoreResult.score,
        matchReason: scoreResult.reason,
      };
    });
    
    return scoredResults
      .filter(r => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  },

  async searchBySimilarity(
    queryEmbedding: number[],
    options: { 
      productId?: number;
      subjectId?: number;
      intentId?: number;
      limit?: number;
      onlyActive?: boolean;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const { limit = 5, onlyActive = false } = options;
    
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    const conditions: SQL[] = [];
    conditions.push(sql`e.embedding_vector IS NOT NULL`);
    
    if (onlyActive) {
      conditions.push(sql`a.is_active = true`);
    }
    
    if (options.productId) {
      conditions.push(sql`a.product_id = ${options.productId}`);
    }
    if (options.subjectId) {
      conditions.push(sql`a.subject_id = ${options.subjectId}`);
    }
    if (options.intentId) {
      conditions.push(sql`a.intent_id = ${options.intentId}`);
    }
    
    const whereClause = and(...conditions);
    
    const results = await db.execute(sql`
      SELECT 
        a.id,
        a.question,
        a.answer,
        a.keywords,
        a.question_variation as "questionVariation",
        a.product_id as "productId",
        a.subject_id as "subjectId",
        a.intent_id as "intentId",
        a.is_active as "isActive",
        a.created_at as "createdAt",
        a.updated_at as "updatedAt",
        ROUND((1 - (e.embedding_vector::vector <=> ${embeddingString}::vector)) * 100) as similarity
      FROM knowledge_base a
      INNER JOIN knowledge_base_embeddings e ON a.id = e.article_id
      WHERE ${whereClause}
      ORDER BY e.embedding_vector::vector <=> ${embeddingString}::vector
      LIMIT ${limit}
    `);
    
    return (results.rows as unknown as SemanticSearchResult[]).map(row => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords,
      questionVariation: row.questionVariation || [],
      productId: row.productId,
      subjectId: row.subjectId,
      intentId: row.intentId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      similarity: Number(row.similarity),
    }));
  },
};
