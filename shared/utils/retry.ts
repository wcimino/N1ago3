export interface RetryConfig {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (attempt: number, error: Error, waitMs: number) => void;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
};

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculateBackoff(
  attempt: number,
  initialBackoffMs: number,
  maxBackoffMs: number
): number {
  const exponentialDelay = initialBackoffMs * Math.pow(2, attempt - 1);
  return Math.min(exponentialDelay, maxBackoffMs);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig & { operationName?: string } = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_CONFIG.maxRetries,
    initialBackoffMs = DEFAULT_CONFIG.initialBackoffMs,
    maxBackoffMs = DEFAULT_CONFIG.maxBackoffMs,
    shouldRetry = () => true,
    onRetry,
    operationName = "operation",
  } = config;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt >= maxRetries) {
        break;
      }

      if (!shouldRetry(lastError, attempt)) {
        break;
      }

      const delay = calculateBackoff(attempt, initialBackoffMs, maxBackoffMs);
      
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      } else {
        console.log(
          `[Retry] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`
        );
      }

      await sleep(delay);
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
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

    const batchResults = await Promise.allSettled(batch.map(item => processor(item)));

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
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
