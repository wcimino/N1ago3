import type { EmbeddableArticle } from "../types.js";
import { generateContentHashFromParts } from "../types.js";

export interface KnowledgeBaseArticleWithProduct {
  id: number;
  question?: string | null;
  answer?: string | null;
  keywords?: string | null;
  questionVariation?: string[];
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
    
    if (this.article.question) {
      parts.push(`Pergunta: ${this.article.question}`);
    }
    
    if (this.article.questionVariation && this.article.questionVariation.length > 0) {
      parts.push(`Variações: ${this.article.questionVariation.join("; ")}`);
    }
    
    if (this.article.answer) {
      parts.push(`Resposta: ${this.article.answer}`);
    }
    
    if (this.article.keywords) {
      parts.push(`Keywords: ${this.article.keywords}`);
    }
    
    if (this.article.productFullName) {
      parts.push(`Produto: ${this.article.productFullName}`);
    }

    return parts.join("\n\n");
  }

  getContentHash(): string {
    return generateContentHashFromParts([
      this.article.question,
      this.article.answer,
      this.article.keywords,
      JSON.stringify(this.article.questionVariation || []),
      this.article.productFullName,
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
  question?: string | null;
  answer?: string | null;
  keywords?: string | null;
  questionVariation?: string[];
  productFullName: string;
}): string {
  return generateContentHashFromParts([
    article.question,
    article.answer,
    article.keywords,
    JSON.stringify(article.questionVariation || []),
    article.productFullName,
  ]);
}

export function generateKBContentForEmbedding(article: {
  question?: string | null;
  answer?: string | null;
  keywords?: string | null;
  questionVariation?: string[];
  productFullName: string;
}): string {
  const parts: string[] = [];
  
  if (article.question) {
    parts.push(`Pergunta: ${article.question}`);
  }
  
  if (article.questionVariation && article.questionVariation.length > 0) {
    parts.push(`Variações: ${article.questionVariation.join("; ")}`);
  }
  
  if (article.answer) {
    parts.push(`Resposta: ${article.answer}`);
  }
  
  if (article.keywords) {
    parts.push(`Keywords: ${article.keywords}`);
  }
  
  if (article.productFullName) {
    parts.push(`Produto: ${article.productFullName}`);
  }

  return parts.join("\n\n");
}
