import type { FilePayload, FormPayload, FormResponsePayload, ActionsPayload } from "./types";

export function safeParsePayload<T>(payload: unknown): T | null {
  if (!payload) return null;
  
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }
  
  return payload as T;
}

export function isValidFilePayload(payload: unknown): payload is FilePayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return p.type === "file" && typeof p.mediaUrl === "string";
}

export function isValidFormPayload(payload: unknown): payload is FormPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.fields) && p.fields.length > 0;
}

export function isValidFormResponsePayload(payload: unknown): payload is FormResponsePayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.fields) || typeof p.textFallback === "string";
}

export function isValidActionsPayload(payload: unknown): payload is ActionsPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.actions) && p.actions.length > 0;
}

export function isValidActionUri(uri: string | undefined): boolean {
  if (!uri) return false;
  const allowedSchemes = ["https:", "http:", "mailto:", "tel:", "whatsapp:"];
  try {
    const url = new URL(uri);
    return allowedSchemes.includes(url.protocol);
  } catch {
    return uri.startsWith("/");
  }
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
