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

function getConfig(): { url: string; token: string } | null {
  const url = process.env.SOLUTION_CENTER_API_URL;
  const token = process.env.SOLUTION_CENTER_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export async function searchSolutionCenter(
  options: SolutionCenterSearchOptions
): Promise<SolutionCenterSearchResponse | null> {
  const config = getConfig();

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SolutionCenterClient] API error ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json() as SolutionCenterSearchResponse;
    console.log(`[SolutionCenterClient] Found ${data.results?.length || 0} results`);

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[SolutionCenterClient] Request timed out after 30s for ${endpoint}`);
    } else {
      console.error("[SolutionCenterClient] Request failed:", error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}
