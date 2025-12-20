import type { ZendeskArticle } from "../../../../shared/schema.js";
import type { EmbeddableArticle } from "../types.js";
import { generateContentHashFromParts } from "../types.js";

export class ZendeskEmbeddableArticle implements EmbeddableArticle {
  id: number;
  private article: ZendeskArticle;

  constructor(article: ZendeskArticle) {
    this.id = article.id;
    this.article = article;
  }

  getContentForEmbedding(): string {
    const parts: string[] = [];
    
    if (this.article.categoryName) {
      parts.push(`Categoria: ${this.article.categoryName}`);
    }
    if (this.article.sectionName) {
      parts.push(`Seção: ${this.article.sectionName}`);
    }
    parts.push(`Título: ${this.article.title}`);

    return parts.join("\n\n");
  }

  getContentHash(): string {
    return generateContentHashFromParts([
      this.article.title,
      this.article.sectionName,
      this.article.categoryName,
    ]);
  }

  static fromArticle(article: ZendeskArticle): ZendeskEmbeddableArticle {
    return new ZendeskEmbeddableArticle(article);
  }

  static fromArticles(articles: ZendeskArticle[]): ZendeskEmbeddableArticle[] {
    return articles.map(a => new ZendeskEmbeddableArticle(a));
  }
}

export function generateZendeskContentHash(article: {
  title: string;
  body: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
}): string {
  return generateContentHashFromParts([
    article.title,
    article.sectionName,
    article.categoryName,
  ]);
}

export function generateZendeskContentForEmbedding(article: {
  title: string;
  body: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
}): string {
  const parts: string[] = [];
  
  if (article.categoryName) {
    parts.push(`Categoria: ${article.categoryName}`);
  }
  if (article.sectionName) {
    parts.push(`Seção: ${article.sectionName}`);
  }
  parts.push(`Título: ${article.title}`);

  return parts.join("\n\n");
}
