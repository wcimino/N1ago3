import * as client from "openid-client";
// @ts-ignore - ESM import works at runtime
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage.js";

const getOidcConfig = memoize(
  async () => {
    try {
      console.log("Fetching OIDC config...");
      const config = await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      console.log("OIDC config fetched successfully");
      return config;
    } catch (error) {
      console.error("Failed to fetch OIDC config:", error);
      throw error;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
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
  await storage.upsertAuthUser({
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

  // Defer OIDC config fetch to avoid blocking startup
  let oidcConfig: Awaited<ReturnType<typeof getOidcConfig>> | null = null;
  
  const getConfig = async () => {
    if (!oidcConfig) {
      oidcConfig = await getOidcConfig();
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

  const registeredStrategies = new Set<string>();

  const getCallbackDomain = (req: any): string => {
    // In production, REPLIT_DOMAINS contains the production domain
    // In development, REPLIT_DEV_DOMAIN contains the dev domain
    // Priority: REPLIT_DOMAINS (production) > REPLIT_DEV_DOMAIN (development) > request host
    const replitDomains = process.env.REPLIT_DOMAINS;
    const devDomain = process.env.REPLIT_DEV_DOMAIN;
    
    if (replitDomains) {
      // Take the first domain if there are multiple (production takes priority)
      return replitDomains.split(',')[0].trim();
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
      registeredStrategies.add(strategyName);
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
      console.error("Login error:", error);
      res.status(500).json({ error: "Authentication service unavailable" });
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
      console.error("Callback error:", error);
      res.redirect("/api/login");
    }
  });

  app.get("/api/logout", async (req, res) => {
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
      console.error("Logout error:", error);
      req.logout(() => {
        res.redirect("/");
      });
    }
  });
}
