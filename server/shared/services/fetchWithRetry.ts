import { sleep, formatDuration, processBatch } from "../../../shared/utils/retry.js";
import type { RetryConfig, BatchProcessConfig } from "../../../shared/utils/retry.js";

export { formatDuration, processBatch };
export type { RetryConfig, BatchProcessConfig };

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialBackoffMs = 1000,
    maxBackoffMs = 60000,
    onRetry,
  } = config;

  let lastError: Error | null = null;
  let backoffMs = initialBackoffMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        lastError = new Error(`Rate limited (429)`);

        if (attempt < maxRetries) {
          onRetry?.(attempt, lastError, waitMs);
          await sleep(waitMs);
          backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
          continue;
        }
      }

      if (response.status >= 500) {
        const errorBody = await response.text();
        lastError = new Error(`Server error: ${response.status} ${response.statusText} - ${errorBody}`);

        if (attempt < maxRetries) {
          onRetry?.(attempt, lastError, backoffMs);
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
          continue;
        }
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        lastError = error;

        if (attempt < maxRetries) {
          onRetry?.(attempt, error, backoffMs);
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError || new Error("Max retries exceeded");
}
