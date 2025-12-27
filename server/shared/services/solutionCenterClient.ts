import { solutionCenterApiLogStorage } from "../storage/solutionCenterApiLogStorage.js";

export type SolutionCenterDemandType = "information" | "sales" | "support";

export interface SolutionCenterSearchRequest {
  text?: string;
  textVerbatim?: string;
  textNormalizedVersions: string[];
  keywords?: string[];
  productName?: string;
  subproductName?: string;
  productConfidence?: number;
  subproductConfidence?: number;
  demandType?: SolutionCenterDemandType;
  demandTypeConfidence?: number;
}

export interface SolutionCenterResult {
  type: "article" | "problem";
  id: string;
  name: string;
  score: number;
}

export interface SolutionCenterSearchResponse {
  results: SolutionCenterResult[];
}

export interface SolutionCenterSearchOptions {
  text?: string;
  textVerbatim?: string;
  textNormalizedVersions: string[];
  keywords?: string[];
  productName?: string;
  subproductName?: string;
  productConfidence?: number;
  subproductConfidence?: number;
  demandType?: SolutionCenterDemandType;
  demandTypeConfidence?: number;
}

export interface SearchLogContext {
  caseDemandId?: number;
  conversationId?: number;
}

function getConfig(): { url: string; token: string } | null {
  const url = process.env.SOLUTION_CENTER_API_URL;
  const token = process.env.SOLUTION_CENTER_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export async function searchSolutionCenter(
  options: SolutionCenterSearchOptions,
  logContext?: SearchLogContext
): Promise<SolutionCenterSearchResponse | null> {
  const config = getConfig();
  const startTime = Date.now();

  if (!config) {
    console.log("[SolutionCenterClient] API not configured (missing SOLUTION_CENTER_API_URL or SOLUTION_CENTER_API_TOKEN)");
    return null;
  }

  const { text, textVerbatim, textNormalizedVersions, keywords, productName, subproductName, productConfidence, subproductConfidence, demandType, demandTypeConfidence } = options;

  if (!textNormalizedVersions || textNormalizedVersions.length === 0) {
    console.log("[SolutionCenterClient] No text versions provided, skipping search");
    return null;
  }

  const endpoint = `${config.url}/api/search/articlesandproblems`;

  const requestBody: SolutionCenterSearchRequest = {
    textNormalizedVersions,
  };

  if (text) {
    requestBody.text = text;
  }

  if (textVerbatim) {
    requestBody.textVerbatim = textVerbatim;
  }

  if (keywords && keywords.length > 0) {
    requestBody.keywords = keywords;
  }

  if (productName) {
    requestBody.productName = productName;
  }

  if (subproductName) {
    requestBody.subproductName = subproductName;
  }

  if (productConfidence !== undefined) {
    requestBody.productConfidence = productConfidence;
  }

  if (subproductConfidence !== undefined) {
    requestBody.subproductConfidence = subproductConfidence;
  }

  if (demandType) {
    requestBody.demandType = demandType;
  }

  if (demandTypeConfidence !== undefined) {
    requestBody.demandTypeConfidence = demandTypeConfidence;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let statusCode: number | undefined;
  let responseData: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;
  let success = false;

  try {
    console.log(`[SolutionCenterClient] Searching with ${textNormalizedVersions.length} text versions at ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.token}`,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    statusCode = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SolutionCenterClient] API error ${response.status}: ${errorText}`);
      errorMessage = errorText;
      return null;
    }

    const data = await response.json();
    responseData = data as Record<string, unknown>;
    success = true;
    console.log(`[SolutionCenterClient] Found ${(data as SolutionCenterSearchResponse).results?.length || 0} results`);

    return data as SolutionCenterSearchResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[SolutionCenterClient] Request timed out after 30s for ${endpoint}`);
      errorMessage = "Request timed out after 30s";
    } else {
      console.error("[SolutionCenterClient] Request failed:", error);
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    try {
      await solutionCenterApiLogStorage.logSearchRequest({
        caseDemandId: logContext?.caseDemandId,
        conversationId: logContext?.conversationId,
        request: requestBody as unknown as Record<string, unknown>,
        response: responseData,
        statusCode,
        success,
        errorMessage,
        durationMs,
      });
    } catch (logError) {
      console.error("[SolutionCenterClient] Failed to log search request:", logError);
    }
  }
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}

// ============================================================================
// Solution Provider API - POST /api/solutions
// ============================================================================

export interface SolutionProviderRequest {
  articleId?: string;
  problemId?: string;
  rootCauseId?: string;
}

export interface SolutionProviderResponse {
  success?: boolean;
  solution?: Record<string, unknown>;
  actions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SolutionLogContext {
  caseSolutionId?: number;
  conversationId?: number;
}

export async function getSolutionFromCenter(
  request: SolutionProviderRequest,
  logContext?: SolutionLogContext
): Promise<SolutionProviderResponse | null> {
  const config = getConfig();
  const startTime = Date.now();

  if (!config) {
    console.log("[SolutionCenterClient] API not configured (missing SOLUTION_CENTER_API_URL or SOLUTION_CENTER_API_TOKEN)");
    return null;
  }

  const { articleId, problemId, rootCauseId } = request;

  if (!articleId && !problemId) {
    console.log("[SolutionCenterClient] Need at least articleId or problemId for solution request", { articleId, problemId, rootCauseId });
    return null;
  }

  const endpoint = `${config.url}/api/solutions`;

  const requestBody: SolutionProviderRequest = {
    articleId,
    problemId,
    rootCauseId,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let statusCode: number | undefined;
  let responseData: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;
  let success = false;

  try {
    console.log(`[SolutionCenterClient] Fetching solution from ${endpoint}`);
    console.log(`[SolutionCenterClient] Request: articleId=${articleId}, problemId=${problemId}, rootCauseId=${rootCauseId}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.token}`,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    statusCode = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SolutionCenterClient] Solution API error ${response.status}: ${errorText}`);
      errorMessage = errorText;
      return null;
    }

    const data = await response.json();
    responseData = data as Record<string, unknown>;
    success = true;
    console.log(`[SolutionCenterClient] Solution response received, success=${data.success}, actions=${Array.isArray(data.actions) ? data.actions.length : 0}`);

    return data as SolutionProviderResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[SolutionCenterClient] Solution request timed out after 30s`);
      errorMessage = "Request timed out after 30s";
    } else {
      console.error("[SolutionCenterClient] Solution request failed:", error);
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    try {
      await solutionCenterApiLogStorage.logSolutionRequest({
        caseSolutionId: logContext?.caseSolutionId,
        conversationId: logContext?.conversationId,
        request: requestBody as unknown as Record<string, unknown>,
        response: responseData,
        statusCode,
        success,
        errorMessage,
        durationMs,
      });
    } catch (logError) {
      console.error("[SolutionCenterClient] Failed to log solution request:", logError);
    }
  }
}
