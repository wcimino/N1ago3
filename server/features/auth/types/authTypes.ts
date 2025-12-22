declare global {
  namespace Express {
    interface User {
      claims: {
        sub: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
        exp?: number;
      };
      access_token: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

export const AUTH_CONFIG = {
  ALLOWED_DOMAIN: "@ifood.com.br",
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 1 week
  OIDC_CONFIG_CACHE_MS: 3600 * 1000, // 1 hour
  SESSION_PRUNE_INTERVAL_SEC: 60 * 15, // 15 minutes
} as const;
