import type { RequestHandler } from "express";
import * as client from "openid-client";
import memoize from "memoizee";
import { storage } from "../storage.js";

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

const ALLOWED_DOMAIN = "@ifood.com.br";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as Express.User | undefined;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    user.claims = tokenResponse.claims() as any;
    user.access_token = tokenResponse.access_token;
    user.refresh_token = tokenResponse.refresh_token;
    user.expires_at = user.claims?.exp;
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const requireAuthorizedUser: RequestHandler = async (req, res, next) => {
  const user = req.user as Express.User | undefined;
  
  if (!user?.claims?.email) {
    return res.status(403).json({ message: "Acesso negado. Email não encontrado no perfil." });
  }

  const email = user.claims.email.toLowerCase();

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(403).json({ 
      message: `Acesso negado. Apenas usuários do domínio ${ALLOWED_DOMAIN} podem acessar.` 
    });
  }

  const isAuthorized = await storage.isUserAuthorized(email);
  if (!isAuthorized) {
    return res.status(403).json({ 
      message: "Acesso negado. Usuário não cadastrado na lista de autorizados." 
    });
  }

  // Update last access timestamp (fire and forget)
  storage.updateLastAccess(email).catch(() => {});

  next();
};

export const protectedRoute: RequestHandler[] = [isAuthenticated, requireAuthorizedUser];
