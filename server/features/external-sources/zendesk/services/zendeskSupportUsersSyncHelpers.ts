import { upsertZendeskUsersBatch } from "../storage/zendeskSupportUsersStorage.js";
import type { InsertZendeskSupportUser } from "../../../../../shared/schema.js";
import { sleep } from "./zendeskSupportUsersApiClient.js";

export async function flushBufferWithRetry(
  buffer: InsertZendeskSupportUser[], 
  maxRetries = 3
): Promise<{ created: number; updated: number; success: boolean }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await upsertZendeskUsersBatch(buffer);
      return { ...result, success: true };
    } catch (err) {
      console.error(`[ZendeskSupportUsers] Error upserting batch (attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }
  return { created: 0, updated: 0, success: false };
}

export function resetSyncState(
  setIsSyncing: (value: boolean) => void,
  setCurrentSyncId: (value: number | null) => void,
  setSyncStartTime: (value: number) => void,
  resetProgress: (value: number) => void,
  setCancelRequested?: (value: boolean) => void
): void {
  setIsSyncing(false);
  setCurrentSyncId(null);
  setSyncStartTime(0);
  resetProgress(0);
  if (setCancelRequested) {
    setCancelRequested(false);
  }
}
