import type { RequestHandler } from "express";
import * as client from "openid-client";
import { getOidcConfig } from "../services/oidcConfig.js";
import { authStorage } from "../storage/authStorage.js";
import { AUTH_CONFIG } from "../types/authTypes.js";
import "../types/authTypes.js";

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

  if (!email.endsWith(AUTH_CONFIG.ALLOWED_DOMAIN)) {
    return res.status(403).json({ 
      message: `Acesso negado. Apenas usuários do domínio ${AUTH_CONFIG.ALLOWED_DOMAIN} podem acessar.` 
    });
  }

  const isAuthorized = await authStorage.isUserAuthorized(email);
  if (!isAuthorized) {
    return res.status(403).json({ 
      message: "Acesso negado. Usuário não cadastrado na lista de autorizados." 
    });
  }

  authStorage.updateLastAccess(email).catch(() => {});

  next();
};

export const protectedRoute: RequestHandler[] = [isAuthenticated, requireAuthorizedUser];
