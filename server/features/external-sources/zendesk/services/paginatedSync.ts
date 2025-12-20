import { upsertZendeskUsersBatch } from "../storage/zendeskSupportUsersStorage.js";
import type { InsertZendeskSupportUser } from "../../../../../shared/schema.js";
import { DB_BATCH_SIZE, sleep, mapApiUserToDbUser } from "./zendeskSupportUsersApiClient.js";
import {
  getCancelRequested,
  getCurrentProgress,
  setCurrentProgress,
  updateProgressMetrics,
} from "./zendeskSupportUsersProgressTracker.js";
import { flushBufferWithRetry } from "./zendeskSupportUsersSyncHelpers.js";

export interface PageFetchResult<T> {
  items: T[];
  nextPage: string | null;
  endOfStream?: boolean;
  count?: number;
}

export interface SyncTotals {
  processed: number;
  created: number;
  updated: number;
  failed: number;
}

export interface PaginationConfig {
  maxItems?: number;
  sleepMs?: number;
  useBuffer?: boolean;
  checkpointInterval?: number;
  onPageComplete?: (pageCount: number, totals: SyncTotals, nextPage: string | null) => Promise<void>;
  onProgress?: (totals: SyncTotals, pageCount: number, estimatedTotal: number) => void;
}

export interface PaginationResult {
  totals: SyncTotals;
  wasCancelled: boolean;
  isComplete: boolean;
  lastCursor: string | null;
  pageCount: number;
}

export async function runPaginatedSync<T>(
  initialUrl: string,
  fetchPage: (url: string) => Promise<PageFetchResult<T>>,
  mapItem: (item: T) => InsertZendeskSupportUser,
  config: PaginationConfig = {}
): Promise<PaginationResult> {
  const {
    maxItems,
    sleepMs = 100,
    useBuffer = false,
    checkpointInterval = 10,
    onPageComplete,
    onProgress,
  } = config;

  const totals: SyncTotals = { processed: 0, created: 0, updated: 0, failed: 0 };
  let url: string | null = initialUrl;
  let pageCount = 0;
  let estimatedTotal = maxItems || 0;
  let lastCheckpointPage = 0;
  let lastCursor: string | null = null;
  let isComplete = false;
  let wasCancelled = false;

  let userBuffer: InsertZendeskSupportUser[] = [];

  while (url && (!maxItems || totals.processed < maxItems) && !getCancelRequested()) {
    pageCount++;
    
    const progress = getCurrentProgress();
    setCurrentProgress({ ...progress, currentPage: pageCount });

    const data = await fetchPage(url);

    if (estimatedTotal === 0 && data.count) {
      estimatedTotal = maxItems ? Math.min(maxItems, data.count) : data.count;
    }

    if (data.items.length === 0 || data.endOfStream) {
      if (data.items.length > 0) {
        const mapped = data.items.map(mapItem);
        const result = await processBatch(mapped);
        totals.created += result.created;
        totals.updated += result.updated;
        totals.processed += mapped.length;
        totals.failed += result.failed;
      }
      isComplete = true;
      break;
    }

    let itemsToProcess = data.items;
    if (maxItems && totals.processed + itemsToProcess.length > maxItems) {
      itemsToProcess = itemsToProcess.slice(0, maxItems - totals.processed);
    }

    const mappedItems = itemsToProcess.map(mapItem);

    if (useBuffer) {
      userBuffer.push(...mappedItems);
      
      if (userBuffer.length >= DB_BATCH_SIZE || !data.nextPage) {
        const { created, updated, success } = await flushBufferWithRetry(userBuffer);
        
        if (success) {
          totals.created += created;
          totals.updated += updated;
          totals.processed += userBuffer.length;
          userBuffer = [];
          lastCursor = data.nextPage;
        } else {
          totals.failed += userBuffer.length;
          break;
        }
      }
    } else {
      const result = await processBatch(mappedItems);
      totals.created += result.created;
      totals.updated += result.updated;
      totals.processed += mappedItems.length;
      totals.failed += result.failed;
    }

    updateProgressMetrics(totals.processed, totals.created, totals.updated, totals.failed, pageCount, estimatedTotal);
    onProgress?.(totals, pageCount, estimatedTotal);

    if (pageCount - lastCheckpointPage >= checkpointInterval && onPageComplete) {
      await onPageComplete(pageCount, totals, useBuffer ? lastCursor : data.nextPage);
      lastCheckpointPage = pageCount;
    }

    url = data.nextPage;
    if (!url) {
      isComplete = true;
    }

    if (url && !getCancelRequested()) {
      await sleep(sleepMs);
    }
  }

  if (useBuffer && userBuffer.length > 0) {
    const { created, updated, success } = await flushBufferWithRetry(userBuffer);
    if (success) {
      totals.created += created;
      totals.updated += updated;
      totals.processed += userBuffer.length;
    } else {
      totals.failed += userBuffer.length;
    }
  }

  if (getCancelRequested()) {
    wasCancelled = true;
  }

  return {
    totals,
    wasCancelled,
    isComplete,
    lastCursor,
    pageCount,
  };
}

async function processBatch(users: InsertZendeskSupportUser[]): Promise<{ created: number; updated: number; failed: number }> {
  try {
    const { created, updated } = await upsertZendeskUsersBatch(users);
    return { created, updated, failed: 0 };
  } catch (err) {
    console.error(`[PaginatedSync] Error upserting batch:`, err);
    return { created: 0, updated: 0, failed: users.length };
  }
}
