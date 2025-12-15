export interface ZendeskArticle {
  id: number;
  zendeskId: string;
  helpCenterSubdomain: string | null;
  title: string;
  body: string | null;
  sectionId: string | null;
  sectionName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  locale: string | null;
  htmlUrl: string | null;
  draft: boolean;
  promoted: boolean;
  voteSum: number | null;
  voteCount: number | null;
  zendeskCreatedAt: string | null;
  zendeskUpdatedAt: string | null;
  syncedAt: string;
}

export interface SyncInfo {
  lastSyncAt: string | null;
  articleCount: number;
}

export interface SyncResult {
  success: boolean;
  articlesTotal: number;
  articlesCreated: number;
  articlesUpdated: number;
  errors: string[];
  syncedAt: string;
}

export interface EmbeddingProgress {
  total: number;
  completed: number;
  pending: number;
  withoutEmbedding: number;
  outdated: number;
  isProcessing: boolean;
  progress: number;
}

export interface Section {
  sectionId: string;
  sectionName: string | null;
  count: number;
}

export interface Subdomain {
  subdomain: string;
  count: number;
}

export interface ArticleViewCount {
  zendeskArticleId: number;
  viewCount: number;
}

export const SUBDOMAIN_LABELS: Record<string, string> = {
  movilepay: "MovilePay",
  centralajudaifp: "Central Ajuda",
};

export function stripHtmlTags(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}
