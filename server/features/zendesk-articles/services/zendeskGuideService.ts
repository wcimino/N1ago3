import { db } from "../../../db.js";
import { zendeskArticles } from "../../../../shared/schema.js";
import { eq, sql, and, desc } from "drizzle-orm";
import { generateArticleEmbedding, embeddingToString } from "./embeddingService.js";

const ZENDESK_SUBDOMAINS = ["movilepay", "centralajudaifp"];

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
  const email = process.env.ZENDESK_SUPPORT_EMAIL;
  const apiToken = process.env.ZENDESK_SUPPORT_API_TOKEN;
  
  if (!email || !apiToken) {
    throw new Error("Missing ZENDESK_SUPPORT_EMAIL or ZENDESK_SUPPORT_API_TOKEN environment variables");
  }
  
  const credentials = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  return `Basic ${credentials}`;
}

function getBaseUrl(subdomain: string): string {
  return `https://${subdomain}.zendesk.com`;
}

async function fetchAllSections(subdomain: string): Promise<Map<string, { name: string; categoryId: string }>> {
  const sections = new Map<string, { name: string; categoryId: string }>();
  let url: string | null = `${getBaseUrl(subdomain)}/api/v2/help_center/sections.json?per_page=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });
    
    if (!response.ok) {
      console.error(`[ZendeskGuide:${subdomain}] Failed to fetch sections: ${response.status}`);
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
  
  console.log(`[ZendeskGuide:${subdomain}] Fetched ${sections.size} sections`);
  return sections;
}

async function fetchAllCategories(subdomain: string): Promise<Map<string, string>> {
  const categories = new Map<string, string>();
  let url: string | null = `${getBaseUrl(subdomain)}/api/v2/help_center/categories.json?per_page=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });
    
    if (!response.ok) {
      console.error(`[ZendeskGuide:${subdomain}] Failed to fetch categories: ${response.status}`);
      break;
    }
    
    const data: ListCategoriesResponse = await response.json();
    
    for (const category of data.categories) {
      categories.set(String(category.id), category.name);
    }
    
    url = data.next_page;
  }
  
  console.log(`[ZendeskGuide:${subdomain}] Fetched ${categories.size} categories`);
  return categories;
}

async function fetchAllArticles(subdomain: string): Promise<ZendeskArticleResponse[]> {
  const articles: ZendeskArticleResponse[] = [];
  let url: string | null = `${getBaseUrl(subdomain)}/api/v2/help_center/articles.json?per_page=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch articles from ${subdomain}: ${response.status} - ${errorText}`);
    }
    
    const data: ListArticlesResponse = await response.json();
    articles.push(...data.articles);
    
    console.log(`[ZendeskGuide:${subdomain}] Fetched page with ${data.articles.length} articles (total: ${articles.length})`);
    
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
  subdomainResults?: Record<string, { total: number; created: number; updated: number }>;
}

async function syncSubdomain(subdomain: string, syncedAt: Date): Promise<{
  total: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  const result = { total: 0, created: 0, updated: 0, errors: [] as string[] };
  
  try {
    console.log(`[ZendeskGuide:${subdomain}] Starting article sync...`);
    
    const [sections, categories, articles] = await Promise.all([
      fetchAllSections(subdomain),
      fetchAllCategories(subdomain),
      fetchAllArticles(subdomain),
    ]);
    
    result.total = articles.length;
    console.log(`[ZendeskGuide:${subdomain}] Processing ${articles.length} articles...`);
    
    for (const article of articles) {
      try {
        const sectionInfo = sections.get(String(article.section_id));
        const categoryId = sectionInfo?.categoryId;
        const categoryName = categoryId ? categories.get(categoryId) : null;
        
        const articleData = {
          zendeskId: String(article.id),
          helpCenterSubdomain: subdomain,
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
          .where(and(
            eq(zendeskArticles.zendeskId, String(article.id)),
            eq(zendeskArticles.helpCenterSubdomain, subdomain)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          await db
            .update(zendeskArticles)
            .set({ ...articleData, updatedAt: syncedAt })
            .where(and(
              eq(zendeskArticles.zendeskId, String(article.id)),
              eq(zendeskArticles.helpCenterSubdomain, subdomain)
            ));
          result.updated++;
        } else {
          await db.insert(zendeskArticles).values(articleData);
          result.created++;
        }
      } catch (err) {
        const errorMsg = `Failed to process article ${article.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[ZendeskGuide:${subdomain}] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    console.log(`[ZendeskGuide:${subdomain}] Sync complete: ${result.created} created, ${result.updated} updated`);
    
  } catch (err) {
    const errorMsg = `[${subdomain}] ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[ZendeskGuide:${subdomain}] Sync failed: ${errorMsg}`);
    result.errors.push(errorMsg);
  }
  
  return result;
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
    subdomainResults: {},
  };
  
  console.log(`[ZendeskGuide] Starting sync for ${ZENDESK_SUBDOMAINS.length} subdomains: ${ZENDESK_SUBDOMAINS.join(", ")}`);
  
  for (const subdomain of ZENDESK_SUBDOMAINS) {
    const subResult = await syncSubdomain(subdomain, syncedAt);
    
    result.articlesTotal += subResult.total;
    result.articlesCreated += subResult.created;
    result.articlesUpdated += subResult.updated;
    result.errors.push(...subResult.errors);
    result.subdomainResults![subdomain] = {
      total: subResult.total,
      created: subResult.created,
      updated: subResult.updated,
    };
  }
  
  result.success = result.errors.length === 0 || result.articlesTotal > 0;
  console.log(`[ZendeskGuide] Total sync complete: ${result.articlesCreated} created, ${result.articlesUpdated} updated across ${ZENDESK_SUBDOMAINS.length} subdomains`);
  
  if (result.articlesCreated > 0 || result.articlesUpdated > 0) {
    generateEmbeddingsForNewArticles().catch((err) => {
      console.error("[ZendeskGuide] Background embedding generation failed:", err);
    });
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

async function generateEmbeddingsForNewArticles(): Promise<void> {
  console.log("[ZendeskGuide] Starting background embedding generation for new articles...");
  
  const articlesWithoutEmbedding = await db
    .select({
      id: zendeskArticles.id,
      title: zendeskArticles.title,
      body: zendeskArticles.body,
      sectionName: zendeskArticles.sectionName,
      categoryName: zendeskArticles.categoryName,
    })
    .from(zendeskArticles)
    .where(sql`${zendeskArticles.embedding} IS NULL`)
    .orderBy(desc(zendeskArticles.zendeskUpdatedAt))
    .limit(50);
  
  if (articlesWithoutEmbedding.length === 0) {
    console.log("[ZendeskGuide] All articles already have embeddings");
    return;
  }
  
  console.log(`[ZendeskGuide] Generating embeddings for ${articlesWithoutEmbedding.length} articles...`);
  
  let processed = 0;
  let errors = 0;
  
  for (const article of articlesWithoutEmbedding) {
    try {
      const embedding = await generateArticleEmbedding({
        title: article.title,
        body: article.body,
        sectionName: article.sectionName,
        categoryName: article.categoryName,
      });
      
      await db
        .update(zendeskArticles)
        .set({
          embedding: embeddingToString(embedding),
          embeddingUpdatedAt: new Date(),
        })
        .where(eq(zendeskArticles.id, article.id));
      
      processed++;
      
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`[ZendeskGuide] Failed to generate embedding for article ${article.id}:`, err);
      errors++;
    }
  }
  
  console.log(`[ZendeskGuide] Background embedding generation complete: ${processed} processed, ${errors} errors`);
}

export const ZendeskGuideService = {
  syncArticles,
  getLastSyncInfo,
  generateEmbeddingsForNewArticles,
};
