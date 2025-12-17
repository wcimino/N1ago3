interface RateLimitEntry {
  minuteCount: number;
  minuteResetAt: number;
  hourCount: number;
  hourResetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
  };
  resetAt: {
    minute: number;
    hour: number;
  };
  retryAfter?: number;
}

const MINUTE_LIMIT = 60;
const HOUR_LIMIT = 600;
const MINUTE_WINDOW = 60 * 1000;
const HOUR_WINDOW = 60 * 60 * 1000;

const rateLimitStore = new Map<number, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.hourResetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(apiKeyId: number, eventCount: number = 1): RateLimitResult {
  const now = Date.now();
  
  let entry = rateLimitStore.get(apiKeyId);
  
  if (!entry) {
    entry = {
      minuteCount: 0,
      minuteResetAt: now + MINUTE_WINDOW,
      hourCount: 0,
      hourResetAt: now + HOUR_WINDOW,
    };
    rateLimitStore.set(apiKeyId, entry);
  }
  
  if (now > entry.minuteResetAt) {
    entry.minuteCount = 0;
    entry.minuteResetAt = now + MINUTE_WINDOW;
  }
  
  if (now > entry.hourResetAt) {
    entry.hourCount = 0;
    entry.hourResetAt = now + HOUR_WINDOW;
  }
  
  const wouldExceedMinute = entry.minuteCount + eventCount > MINUTE_LIMIT;
  const wouldExceedHour = entry.hourCount + eventCount > HOUR_LIMIT;
  
  if (wouldExceedMinute || wouldExceedHour) {
    const retryAfterMinute = wouldExceedMinute ? Math.ceil((entry.minuteResetAt - now) / 1000) : 0;
    const retryAfterHour = wouldExceedHour ? Math.ceil((entry.hourResetAt - now) / 1000) : 0;
    
    return {
      allowed: false,
      remaining: {
        minute: Math.max(0, MINUTE_LIMIT - entry.minuteCount),
        hour: Math.max(0, HOUR_LIMIT - entry.hourCount),
      },
      resetAt: {
        minute: entry.minuteResetAt,
        hour: entry.hourResetAt,
      },
      retryAfter: Math.max(retryAfterMinute, retryAfterHour),
    };
  }
  
  entry.minuteCount += eventCount;
  entry.hourCount += eventCount;
  
  return {
    allowed: true,
    remaining: {
      minute: MINUTE_LIMIT - entry.minuteCount,
      hour: HOUR_LIMIT - entry.hourCount,
    },
    resetAt: {
      minute: entry.minuteResetAt,
      hour: entry.hourResetAt,
    },
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit-Minute": String(MINUTE_LIMIT),
    "X-RateLimit-Limit-Hour": String(HOUR_LIMIT),
    "X-RateLimit-Remaining-Minute": String(result.remaining.minute),
    "X-RateLimit-Remaining-Hour": String(result.remaining.hour),
    "X-RateLimit-Reset-Minute": String(Math.ceil(result.resetAt.minute / 1000)),
    "X-RateLimit-Reset-Hour": String(Math.ceil(result.resetAt.hour / 1000)),
    ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}),
  };
}

export const RATE_LIMITS = {
  MINUTE_LIMIT,
  HOUR_LIMIT,
};
