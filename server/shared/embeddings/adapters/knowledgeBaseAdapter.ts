import type { EmbeddableArticle } from "../types.js";
import { generateContentHashFromParts } from "../types.js";

export interface KnowledgeBaseArticleWithProduct {
  id: number;
  name?: string | null;
  productFullName: string;
  description: string;
  resolution: string;
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
    
    if (this.article.name) {
      parts.push(`Nome: ${this.article.name}`);
    }
    
    parts.push(`Produto: ${this.article.productFullName}`);
    
    parts.push(`Descrição: ${this.article.description}`);
    parts.push(`Resolução: ${this.article.resolution}`);

    return parts.join("\n\n");
  }

  getContentHash(): string {
    return generateContentHashFromParts([
      this.article.name,
      this.article.productFullName,
      this.article.description,
      this.article.resolution,
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
  name?: string | null;
  productFullName: string;
  description: string;
  resolution: string;
}): string {
  return generateContentHashFromParts([
    article.name,
    article.productFullName,
    article.description,
    article.resolution,
  ]);
}

export function generateKBContentForEmbedding(article: {
  name?: string | null;
  productFullName: string;
  description: string;
  resolution: string;
}): string {
  const parts: string[] = [];
  
  if (article.name) {
    parts.push(`Nome: ${article.name}`);
  }
  
  parts.push(`Produto: ${article.productFullName}`);
  
  parts.push(`Descrição: ${article.description}`);
  parts.push(`Resolução: ${article.resolution}`);

  return parts.join("\n\n");
}
