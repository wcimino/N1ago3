import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";
import type { EmbeddableArticle } from "../types.js";
import { generateContentHashFromParts } from "../types.js";

export class KnowledgeBaseEmbeddableArticle implements EmbeddableArticle {
  id: number;
  private article: KnowledgeBaseArticle;

  constructor(article: KnowledgeBaseArticle) {
    this.id = article.id;
    this.article = article;
  }

  getContentForEmbedding(): string {
    const parts: string[] = [];
    
    parts.push(`Produto: ${this.article.productStandard}`);
    
    if (this.article.subproductStandard) {
      parts.push(`Subproduto: ${this.article.subproductStandard}`);
    }
    
    parts.push(`Descrição: ${this.article.description}`);
    parts.push(`Resolução: ${this.article.resolution}`);

    return parts.join("\n\n");
  }

  getContentHash(): string {
    return generateContentHashFromParts([
      this.article.productStandard,
      this.article.subproductStandard,
      this.article.description,
      this.article.resolution,
    ]);
  }

  static fromArticle(article: KnowledgeBaseArticle): KnowledgeBaseEmbeddableArticle {
    return new KnowledgeBaseEmbeddableArticle(article);
  }

  static fromArticles(articles: KnowledgeBaseArticle[]): KnowledgeBaseEmbeddableArticle[] {
    return articles.map(a => new KnowledgeBaseEmbeddableArticle(a));
  }
}

export function generateKBContentHash(article: {
  productStandard: string;
  subproductStandard?: string | null;
  description: string;
  resolution: string;
}): string {
  return generateContentHashFromParts([
    article.productStandard,
    article.subproductStandard,
    article.description,
    article.resolution,
  ]);
}

export function generateKBContentForEmbedding(article: {
  productStandard: string;
  subproductStandard?: string | null;
  description: string;
  resolution: string;
}): string {
  const parts: string[] = [];
  
  parts.push(`Produto: ${article.productStandard}`);
  
  if (article.subproductStandard) {
    parts.push(`Subproduto: ${article.subproductStandard}`);
  }
  
  parts.push(`Descrição: ${article.description}`);
  parts.push(`Resolução: ${article.resolution}`);

  return parts.join("\n\n");
}
