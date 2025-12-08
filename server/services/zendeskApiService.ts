import { db } from "../db.js";
import { zendeskApiLogs } from "../../shared/schema.js";

const ZENDESK_APP_ID = "5fbcf8fffea626000bbaa1eb";
const ZENDESK_BASE_URL = "https://api.smooch.io";

interface ApiCallOptions {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  conversationId?: string;
  requestType: string;
  contextType?: string;
  contextId?: string;
}

interface ApiCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

interface SendMessageResponse {
  message: {
    id: string;
    received: string;
    author: {
      type: string;
      displayName?: string;
    };
    content: {
      type: string;
      text?: string;
    };
  };
}

interface PassControlResponse {
  switchboardConversation: {
    id: string;
    activeSwitchboardIntegration: {
      id: string;
      name: string;
    };
    pendingPassControl?: {
      targetSwitchboardIntegration: {
        id: string;
        name: string;
      };
    };
  };
}

function getApiKey(): string {
  const key = process.env.ZENDESK_APP_API_KEY;
  
  if (!key) {
    throw new Error("Missing ZENDESK_APP_API_KEY environment variable");
  }
  
  return key;
}

function getAuthHeader(): string {
  const apiKey = getApiKey();
  const credentials = Buffer.from(apiKey).toString("base64");
  return `Basic ${credentials}`;
}

async function logApiCall(
  options: ApiCallOptions,
  result: ApiCallResult,
  durationMs: number
): Promise<void> {
  try {
    await db.insert(zendeskApiLogs).values({
      requestType: options.requestType,
      endpoint: options.endpoint,
      method: options.method,
      conversationId: options.conversationId,
      requestPayload: options.body ?? null,
      responseRaw: result.data ?? null,
      responseStatus: result.status,
      durationMs,
      success: result.success,
      errorMessage: result.error,
      contextType: options.contextType,
      contextId: options.contextId,
    });
  } catch (err) {
    console.error("[ZendeskApiService] Failed to log API call:", err);
  }
}

async function makeApiCall<T = unknown>(options: ApiCallOptions): Promise<ApiCallResult<T>> {
  const url = `${ZENDESK_BASE_URL}${options.endpoint}`;
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        "Authorization": getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    const durationMs = Date.now() - startTime;
    
    let data: T | undefined;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json() as T;
    }
    
    const result: ApiCallResult<T> = {
      success: response.ok,
      data,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
    
    await logApiCall(options, result as ApiCallResult, durationMs);
    
    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    const result: ApiCallResult<T> = {
      success: false,
      error: errorMessage,
    };
    
    await logApiCall(options, result as ApiCallResult, durationMs);
    
    return result;
  }
}

export async function sendMessage(
  conversationId: string,
  text: string,
  contextType?: string,
  contextId?: string
): Promise<ApiCallResult<SendMessageResponse>> {
  console.log(`[ZendeskApiService] Sending message to conversation ${conversationId}`);
  
  return makeApiCall<SendMessageResponse>({
    endpoint: `/v2/apps/${ZENDESK_APP_ID}/conversations/${conversationId}/messages`,
    method: "POST",
    body: {
      author: { type: "business" },
      content: { type: "text", text },
    },
    conversationId,
    requestType: "sendMessage",
    contextType,
    contextId,
  });
}

export async function passControl(
  conversationId: string,
  targetIntegrationId: string,
  metadata?: Record<string, unknown>,
  contextType?: string,
  contextId?: string
): Promise<ApiCallResult<PassControlResponse>> {
  console.log(`[ZendeskApiService] Passing control for conversation ${conversationId} to ${targetIntegrationId}`);
  
  return makeApiCall<PassControlResponse>({
    endpoint: `/v2/apps/${ZENDESK_APP_ID}/conversations/${conversationId}/passControl`,
    method: "POST",
    body: {
      switchboardIntegration: targetIntegrationId,
      ...(metadata && { metadata }),
    },
    conversationId,
    requestType: "passControl",
    contextType,
    contextId,
  });
}

export async function offerControl(
  conversationId: string,
  targetIntegrationId: string,
  metadata?: Record<string, unknown>,
  contextType?: string,
  contextId?: string
): Promise<ApiCallResult<PassControlResponse>> {
  console.log(`[ZendeskApiService] Offering control for conversation ${conversationId} to ${targetIntegrationId}`);
  
  return makeApiCall<PassControlResponse>({
    endpoint: `/v2/apps/${ZENDESK_APP_ID}/conversations/${conversationId}/offerControl`,
    method: "POST",
    body: {
      switchboardIntegration: targetIntegrationId,
      ...(metadata && { metadata }),
    },
    conversationId,
    requestType: "offerControl",
    contextType,
    contextId,
  });
}

export async function acceptControl(
  conversationId: string,
  contextType?: string,
  contextId?: string
): Promise<ApiCallResult<PassControlResponse>> {
  console.log(`[ZendeskApiService] Accepting control for conversation ${conversationId}`);
  
  return makeApiCall<PassControlResponse>({
    endpoint: `/v2/apps/${ZENDESK_APP_ID}/conversations/${conversationId}/acceptControl`,
    method: "POST",
    conversationId,
    requestType: "acceptControl",
    contextType,
    contextId,
  });
}

export async function releaseControl(
  conversationId: string,
  contextType?: string,
  contextId?: string
): Promise<ApiCallResult<PassControlResponse>> {
  console.log(`[ZendeskApiService] Releasing control for conversation ${conversationId}`);
  
  return makeApiCall<PassControlResponse>({
    endpoint: `/v2/apps/${ZENDESK_APP_ID}/conversations/${conversationId}/releaseControl`,
    method: "POST",
    conversationId,
    requestType: "releaseControl",
    contextType,
    contextId,
  });
}

export function getAgentWorkspaceIntegrationId(): string {
  return "5fbcf90112addf000c227bb2";
}

export function getN1agoIntegrationId(): string {
  const isDev = process.env.NODE_ENV !== "production";
  return isDev ? "69357782256891c6fda71018" : "693577c73ef61062218d9705";
}

export const ZendeskApiService = {
  sendMessage,
  passControl,
  offerControl,
  acceptControl,
  releaseControl,
  getAgentWorkspaceIntegrationId,
  getN1agoIntegrationId,
};
