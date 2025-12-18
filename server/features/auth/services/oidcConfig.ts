import * as client from "openid-client";
import memoize from "memoizee";
import { AUTH_CONFIG } from "../types/authTypes.js";

export const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: AUTH_CONFIG.OIDC_CONFIG_CACHE_MS }
);
