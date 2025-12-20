export type SolutionCenterDemandType = "information" | "sales" | "support";

export interface SolutionCenterSearchRequest {
  text?: string;
  textNormalizedVersions: string[];
  keywords?: string[];
  productName?: string;
  subproductName?: string;
  demandType?: SolutionCenterDemandType;
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
  textNormalizedVersions: string[];
  keywords?: string[];
  productName?: string;
  subproductName?: string;
  demandType?: SolutionCenterDemandType;
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

  const { text, textNormalizedVersions, keywords, productName, subproductName, demandType } = options;

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

  if (keywords && keywords.length > 0) {
    requestBody.keywords = keywords;
  }

  if (productName) {
    requestBody.productName = productName;
  }

  if (subproductName) {
    requestBody.subproductName = subproductName;
  }

  if (demandType) {
    requestBody.demandType = demandType;
  }

  try {
    console.log(`[SolutionCenterClient] Searching with ${textNormalizedVersions.length} text versions`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.token}`,
      },
      body: JSON.stringify(requestBody),
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
    console.error("[SolutionCenterClient] Request failed:", error);
    return null;
  }
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}
