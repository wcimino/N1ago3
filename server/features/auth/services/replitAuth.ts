import * as client from "openid-client";
// @ts-ignore - ESM import works at runtime
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express } from "express";
import connectPg from "connect-pg-simple";
import { getOidcConfig } from "./oidcConfig.js";
import { authStorage } from "../storage/authStorage.js";
import { AUTH_CONFIG } from "../types/authTypes.js";
import "../types/authTypes.js";

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: AUTH_CONFIG.SESSION_TTL_MS,
    tableName: "sessions",
    pruneSessionInterval: AUTH_CONFIG.SESSION_PRUNE_INTERVAL_SEC,
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: AUTH_CONFIG.SESSION_TTL_MS,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertAuthUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  let oidcConfig: Awaited<ReturnType<typeof getOidcConfig>> | null = null;
  
  const getConfig = async () => {
    if (!oidcConfig) {
      console.log("[Auth] Loading OIDC config...");
      oidcConfig = await getOidcConfig();
      console.log("[Auth] OIDC config loaded successfully");
    }
    return oidcConfig;
  };

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: Express.User = {
      claims: tokens.claims() as any,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.claims()?.exp,
    };
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Map<string, boolean>();

  const getCallbackDomain = (req: any): string => {
    const replitDomains = process.env.REPLIT_DOMAINS;
    const devDomain = process.env.REPLIT_DEV_DOMAIN;
    
    if (replitDomains) {
      try {
        const domains = JSON.parse(replitDomains);
        if (Array.isArray(domains) && domains.length > 0) {
          return domains[0];
        }
      } catch {
        return replitDomains.split(',')[0].trim();
      }
    }
    
    if (devDomain) {
      return devDomain;
    }
    
    return req.get("host") || req.hostname;
  };

  const ensureStrategy = async (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const config = await getConfig();
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.set(strategyName, true);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    try {
      const domain = getCallbackDomain(req);
      console.log("Login attempt - domain:", domain);
      console.log("REPLIT_DOMAINS:", process.env.REPLIT_DOMAINS);
      console.log("REPLIT_DEV_DOMAIN:", process.env.REPLIT_DEV_DOMAIN);
      console.log("Callback URL will be:", `https://${domain}/api/callback`);
      await ensureStrategy(domain);
      passport.authenticate(`replitauth:${domain}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (error) {
      console.error("[Auth] Login error:", error);
      next(error);
    }
  });

  app.get("/api/callback", async (req, res, next) => {
    try {
      const domain = getCallbackDomain(req);
      console.log("Callback - domain:", domain);
      await ensureStrategy(domain);
      passport.authenticate(`replitauth:${domain}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    } catch (error) {
      console.error("[Auth] Callback error:", error);
      next(error);
    }
  });

  app.get("/api/logout", async (req, res, next) => {
    try {
      const domain = getCallbackDomain(req);
      const config = await getConfig();
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `https://${domain}`,
          }).href
        );
      });
    } catch (error) {
      console.error("[Auth] Logout error:", error);
      next(error);
    }
  });
}
