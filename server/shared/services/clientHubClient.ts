import { clientHubApiLogStorage } from "../storage/clientHubApiLogStorage.js";
import type { ClientHubData } from "../../../shared/schema/clientHub.js";

function getBaseUrl(): string {
  return process.env.CLIENT_HUB_API_BASE_URL || "https://pago-client-hub.replit.app";
}

export interface ClientHubLogContext {
  conversationId?: number;
}

function getToken(): string | null {
  return process.env.CLIENT_HUB_API_TOKEN || process.env.CLIENT_HUB || null;
}

export async function fetchClientByAccountRef(
  accountRef: string,
  logContext?: ClientHubLogContext
): Promise<ClientHubData | null> {
  const token = getToken();
  const startTime = Date.now();
  const requestUrl = `${getBaseUrl()}/api/search/client`;

  if (!token) {
    console.log("[ClientHubClient] API not configured (missing CLIENT_HUB secret)");
    return null;
  }

  if (!accountRef) {
    console.log("[ClientHubClient] No accountRef provided, skipping");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let statusCode: number | undefined;
  let responseData: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;
  let success = false;

  try {
    console.log(`[ClientHubClient] Fetching client data for accountRef: ${accountRef}`);

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountRef }),
      signal: controller.signal,
    });

    statusCode = response.status;

    if (response.status === 404) {
      console.log(`[ClientHubClient] Client not found for accountRef: ${accountRef}`);
      success = true;
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ClientHubClient] API error ${response.status}: ${errorText}`);
      errorMessage = errorText;
      return null;
    }

    const data = await response.json();
    responseData = data as Record<string, unknown>;
    success = true;

    const clientData: ClientHubData = {
      cnpj: data.cnpj,
      cnpjValido: data.cnpjValido,
      campos: data.campos,
      fetchedAt: new Date().toISOString(),
    };

    console.log(`[ClientHubClient] Successfully fetched client data for accountRef: ${accountRef}`);
    return clientData;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[ClientHubClient] Request timed out after 30s for accountRef: ${accountRef}`);
      errorMessage = "Request timed out after 30s";
    } else {
      console.error("[ClientHubClient] Request failed:", error);
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    try {
      await clientHubApiLogStorage.logRequest({
        conversationId: logContext?.conversationId,
        accountRef,
        requestUrl,
        responseStatus: statusCode,
        responseData,
        success,
        errorMessage,
        durationMs,
      });
    } catch (logError) {
      console.error("[ClientHubClient] Failed to log request:", logError);
    }
  }
}

export function isConfigured(): boolean {
  return getToken() !== null;
}
