import { db } from "../../../db.js";
import { zendeskArticles } from "../../../../shared/schema.js";
import { eq, sql } from "drizzle-orm";

const ZENDESK_SUBDOMAIN = "movilepay";

interface ZendeskArticleResponse {
  id: number;
  title: string;
  body: string;
  section_id: number;
  author_id: number;
  locale: string;
  html_url: string;
  draft: boolean;
  promoted: boolean;
  position: number;
  vote_sum: number;
  vote_count: number;
  label_names: string[];
  created_at: string;
  updated_at: string;
}

interface ZendeskSectionResponse {
  id: number;
  name: string;
  category_id: number;
  locale: string;
}

interface ZendeskCategoryResponse {
  id: number;
  name: string;
  locale: string;
}

interface ListArticlesResponse {
  articles: ZendeskArticleResponse[];
  page: number;
  per_page: number;
  page_count: number;
  count: number;
  next_page: string | null;
  previous_page: string | null;
}

interface ListSectionsResponse {
  sections: ZendeskSectionResponse[];
  next_page: string | null;
}

interface ListCategoriesResponse {
  categories: ZendeskCategoryResponse[];
  next_page: string | null;
}

function getAuthHeader(): string {
  const apiKey = process.env.ZENDESK_APP_API_KEY;
  
  if (!apiKey) {
    throw new Error("Missing ZENDESK_APP_API_KEY environment variable");
  }
  
  const credentials = Buffer.from(apiKey).toString("base64");
  return `Basic ${credentials}`;
}

function getBaseUrl(): string {
  return `https://${ZENDESK_SUBDOMAIN}.zendesk.com`;
}

async function fetchAllSections(): Promise<Map<string, { name: string; categoryId: string }>> {
  const sections = new Map<string, { name: string; categoryId: string }>();
  let url: string | null = `${getBaseUrl()}/api/v2/help_center/sections.json?per_page=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });
    
    if (!response.ok) {
      console.error(`[ZendeskGuide] Failed to fetch sections: ${response.status}`);
      break;
    }
    
    const data: ListSectionsResponse = await response.json();
    
    for (const section of data.sections) {
      sections.set(String(section.id), {
        name: section.name,
        categoryId: String(section.category_id),
      });
    }
    
    url = data.next_page;
  }
  
  console.log(`[ZendeskGuide] Fetched ${sections.size} sections`);
  return sections;
}

async function fetchAllCategories(): Promise<Map<string, string>> {
  const categories = new Map<string, string>();
  let url: string | null = `${getBaseUrl()}/api/v2/help_center/categories.json?per_page=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });
    
    if (!response.ok) {
      console.error(`[ZendeskGuide] Failed to fetch categories: ${response.status}`);
      break;
    }
    
    const data: ListCategoriesResponse = await response.json();
    
    for (const category of data.categories) {
      categories.set(String(category.id), category.name);
    }
    
    url = data.next_page;
  }
  
  console.log(`[ZendeskGuide] Fetched ${categories.size} categories`);
  return categories;
}

async function fetchAllArticles(): Promise<ZendeskArticleResponse[]> {
  const articles: ZendeskArticleResponse[] = [];
  let url: string | null = `${getBaseUrl()}/api/v2/help_center/articles.json?per_page=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch articles: ${response.status} - ${errorText}`);
    }
    
    const data: ListArticlesResponse = await response.json();
    articles.push(...data.articles);
    
    console.log(`[ZendeskGuide] Fetched page with ${data.articles.length} articles (total: ${articles.length})`);
    
    url = data.next_page;
  }
  
  return articles;
}

export interface SyncResult {
  success: boolean;
  articlesTotal: number;
  articlesCreated: number;
  articlesUpdated: number;
  errors: string[];
  syncedAt: Date;
}

export async function syncArticles(): Promise<SyncResult> {
  const syncedAt = new Date();
  const result: SyncResult = {
    success: false,
    articlesTotal: 0,
    articlesCreated: 0,
    articlesUpdated: 0,
    errors: [],
    syncedAt,
  };
  
  try {
    console.log("[ZendeskGuide] Starting article sync...");
    
    const [sections, categories, articles] = await Promise.all([
      fetchAllSections(),
      fetchAllCategories(),
      fetchAllArticles(),
    ]);
    
    result.articlesTotal = articles.length;
    console.log(`[ZendeskGuide] Processing ${articles.length} articles...`);
    
    for (const article of articles) {
      try {
        const sectionInfo = sections.get(String(article.section_id));
        const categoryId = sectionInfo?.categoryId;
        const categoryName = categoryId ? categories.get(categoryId) : null;
        
        const articleData = {
          zendeskId: String(article.id),
          title: article.title,
          body: article.body,
          sectionId: String(article.section_id),
          sectionName: sectionInfo?.name ?? null,
          categoryId: categoryId ?? null,
          categoryName: categoryName ?? null,
          authorId: String(article.author_id),
          locale: article.locale,
          htmlUrl: article.html_url,
          draft: article.draft,
          promoted: article.promoted,
          position: article.position,
          voteSum: article.vote_sum,
          voteCount: article.vote_count,
          labelNames: article.label_names,
          zendeskCreatedAt: new Date(article.created_at),
          zendeskUpdatedAt: new Date(article.updated_at),
          syncedAt,
        };
        
        const existing = await db
          .select({ id: zendeskArticles.id })
          .from(zendeskArticles)
          .where(eq(zendeskArticles.zendeskId, String(article.id)))
          .limit(1);
        
        if (existing.length > 0) {
          await db
            .update(zendeskArticles)
            .set({ ...articleData, updatedAt: syncedAt })
            .where(eq(zendeskArticles.zendeskId, String(article.id)));
          result.articlesUpdated++;
        } else {
          await db.insert(zendeskArticles).values(articleData);
          result.articlesCreated++;
        }
      } catch (err) {
        const errorMsg = `Failed to process article ${article.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[ZendeskGuide] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    result.success = true;
    console.log(`[ZendeskGuide] Sync complete: ${result.articlesCreated} created, ${result.articlesUpdated} updated`);
    
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ZendeskGuide] Sync failed: ${errorMsg}`);
    result.errors.push(errorMsg);
  }
  
  return result;
}

export async function getLastSyncInfo(): Promise<{ lastSyncAt: Date | null; articleCount: number }> {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(zendeskArticles);
  
  const [lastSync] = await db
    .select({ syncedAt: zendeskArticles.syncedAt })
    .from(zendeskArticles)
    .orderBy(sql`${zendeskArticles.syncedAt} desc`)
    .limit(1);
  
  return {
    lastSyncAt: lastSync?.syncedAt ?? null,
    articleCount: countResult?.count ?? 0,
  };
}

export const ZendeskGuideService = {
  syncArticles,
  getLastSyncInfo,
};
