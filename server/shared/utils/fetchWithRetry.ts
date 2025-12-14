export interface FetchWithRetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  logPrefix?: string;
}

const DEFAULT_OPTIONS: Required<FetchWithRetryOptions> = {
  maxRetries: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
  logPrefix: "[FetchWithRetry]",
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
  retryOptions: FetchWithRetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  let backoffMs = config.initialBackoffMs;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        console.log(`${config.logPrefix} Rate limited (429). Waiting ${waitMs}ms before retry ${attempt}/${config.maxRetries}...`);
        await sleep(waitMs);
        backoffMs = Math.min(backoffMs * 2, config.maxBackoffMs);
        continue;
      }
      
      if (response.status >= 500) {
        const errorBody = await response.text();
        console.log(`${config.logPrefix} Server error (${response.status}). Retrying ${attempt}/${config.maxRetries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, config.maxBackoffMs);
        lastError = new Error(`API error: ${response.status} ${response.statusText} - ${errorBody}`);
        continue;
      }
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      
      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log(`${config.logPrefix} Network error. Retrying ${attempt}/${config.maxRetries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, config.maxBackoffMs);
        lastError = error as Error;
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
