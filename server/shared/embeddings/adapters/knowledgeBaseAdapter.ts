import type { EmbeddableArticle } from "../types.js";
import { generateContentHashFromParts } from "../types.js";

function parseQuestionNormalized(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch { }
  }
  return [];
}

function normalizeKeywords(keywords: string | null | undefined): string {
  if (!keywords) return '';
  return keywords.split(',').map(k => k.trim()).filter(k => k).join(', ');
}

export interface KnowledgeBaseArticleWithProduct {
  id: number;
  question?: string | null;
  answer?: string | null;
  keywords?: string | null;
  questionVariation?: string[];
  questionNormalized?: string[] | string | null;
  productFullName: string;
}

export class KnowledgeBaseEmbeddableArticle implements EmbeddableArticle {
  id: number;
  private article: KnowledgeBaseArticleWithProduct;

  constructor(article: KnowledgeBaseArticleWithProduct) {
    this.id = article.id;
    this.article = article;
  }

  getContentForEmbedding(): string {
    const parts: string[] = [];
    
    const normalized = parseQuestionNormalized(this.article.questionNormalized as any);
    if (normalized.length > 0) {
      parts.push(normalized.join("; "));
    }
    
    const keywords = normalizeKeywords(this.article.keywords);
    if (keywords) {
      parts.push(keywords);
    }

    return parts.join("\n\n");
  }

  getContentHash(): string {
    const normalized = parseQuestionNormalized(this.article.questionNormalized as any);
    const keywords = normalizeKeywords(this.article.keywords);
    return generateContentHashFromParts([
      JSON.stringify(normalized),
      keywords,
    ]);
  }

  static fromArticle(article: KnowledgeBaseArticleWithProduct): KnowledgeBaseEmbeddableArticle {
    return new KnowledgeBaseEmbeddableArticle(article);
  }

  static fromArticles(articles: KnowledgeBaseArticleWithProduct[]): KnowledgeBaseEmbeddableArticle[] {
    return articles.map(a => new KnowledgeBaseEmbeddableArticle(a));
  }
}

export function generateKBContentHash(article: {
  keywords?: string | null;
  questionNormalized?: string[] | string | null;
}): string {
  const normalized = parseQuestionNormalized(article.questionNormalized);
  const keywords = normalizeKeywords(article.keywords);
  return generateContentHashFromParts([
    JSON.stringify(normalized),
    keywords,
  ]);
}

export function generateKBContentForEmbedding(article: {
  keywords?: string | null;
  questionNormalized?: string[] | string | null;
}): string {
  const parts: string[] = [];
  
  const normalized = parseQuestionNormalized(article.questionNormalized);
  if (normalized.length > 0) {
    parts.push(normalized.join("; "));
  }
  
  const keywords = normalizeKeywords(article.keywords);
  if (keywords) {
    parts.push(keywords);
  }

  return parts.join("\n\n");
}
