export interface RetryConfig {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  onRetry?: (attempt: number, error: Error, waitMs: number) => void;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetry'>> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "calculating...";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  config: RetryConfig = {}
): Promise<T> {
  const { 
    maxRetries = DEFAULT_CONFIG.maxRetries,
    initialBackoffMs = DEFAULT_CONFIG.initialBackoffMs,
    maxBackoffMs = DEFAULT_CONFIG.maxBackoffMs,
    onRetry,
  } = config;

  let lastError: Error | null = null;
  let backoffMs = initialBackoffMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        
        if (attempt < maxRetries) {
          onRetry?.(attempt, new Error(`Rate limited (429)`), waitMs);
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
      if (error instanceof TypeError && error.message.includes('fetch')) {
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

  throw lastError || new Error('Max retries exceeded');
}

export interface BatchProcessConfig {
  batchSize?: number;
  delayBetweenBatchesMs?: number;
  onBatchComplete?: (processed: number, total: number) => void;
}

export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: BatchProcessConfig = {}
): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
  const {
    batchSize = 10,
    delayBetweenBatchesMs = 100,
    onBatchComplete,
  } = config;

  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({ item: batch[index], error: result.reason });
      }
    });

    processed += batch.length;
    onBatchComplete?.(processed, items.length);

    if (i + batchSize < items.length && delayBetweenBatchesMs > 0) {
      await sleep(delayBetweenBatchesMs);
    }
  }

  return { results, errors };
}
