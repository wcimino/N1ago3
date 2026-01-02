import { resolveAuthentication, type AuthenticationResult } from "./authenticationResolver.js";
import { fetchCustomerData, type CustomerDataResult } from "./customerDataFetcher.js";
import { summaryStorage } from "../../ai/storage/summaryStorage.js";

export interface ClientContextParams {
  conversationId: number;
  userExternalId?: string;
  externalUserId?: string;
  accountRef?: string;
}

export interface ClientContextResult {
  authenticated: boolean;
  authResolvedVia: string;
  customerDataStatus: string;
  persisted: boolean;
  error?: string;
}

export async function enrichClientContext(params: ClientContextParams): Promise<ClientContextResult> {
  const { conversationId, userExternalId, externalUserId, accountRef } = params;

  console.log(`[ClientContextService] Starting enrichment for conversation ${conversationId}`);
  console.log(`[ClientContextService] Identifiers: userExternalId=${userExternalId}, externalUserId=${externalUserId}, accountRef=${accountRef}`);

  let authResult: AuthenticationResult;
  let customerResult: CustomerDataResult;

  try {
    [authResult, customerResult] = await Promise.all([
      resolveAuthentication({ userExternalId, externalUserId }).catch((err): AuthenticationResult => {
        console.error(`[ClientContextService] Auth resolution failed for conversation ${conversationId}:`, err);
        return { authenticated: false, resolvedVia: "none", error: err instanceof Error ? err.message : String(err) };
      }),
      fetchCustomerData({ accountRef, conversationId }).catch((err): CustomerDataResult => {
        console.error(`[ClientContextService] Customer data fetch failed for conversation ${conversationId}:`, err);
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }),
    ]);
  } catch (error) {
    console.error(`[ClientContextService] Unexpected error during parallel fetch for conversation ${conversationId}:`, error);
    authResult = { authenticated: false, resolvedVia: "none", error: error instanceof Error ? error.message : String(error) };
    customerResult = { status: "error", error: error instanceof Error ? error.message : String(error) };
  }

  let existingData: any = null;
  try {
    existingData = await summaryStorage.getClientHubData(conversationId);
  } catch (readError) {
    console.warn(`[ClientContextService] Failed to read existing data for conversation ${conversationId}, proceeding with fresh data:`, readError);
  }

  const mergedData = {
    ...(existingData ?? {}),
    ...(customerResult.payload ?? {}),
    authenticated: authResult.authenticated,
    authResolvedVia: authResult.resolvedVia,
    enrichedAt: new Date().toISOString(),
  };

  try {
    await summaryStorage.updateClientHubData(conversationId, mergedData);

    console.log(`[ClientContextService] Successfully enriched conversation ${conversationId}: authenticated=${authResult.authenticated}, customerData=${customerResult.status}`);

    return {
      authenticated: authResult.authenticated,
      authResolvedVia: authResult.resolvedVia,
      customerDataStatus: customerResult.status,
      persisted: true,
    };
  } catch (writeError) {
    console.error(`[ClientContextService] Error persisting context for conversation ${conversationId}:`, writeError);
    return {
      authenticated: authResult.authenticated,
      authResolvedVia: authResult.resolvedVia,
      customerDataStatus: customerResult.status,
      persisted: false,
      error: writeError instanceof Error ? writeError.message : String(writeError),
    };
  }
}

export const clientContextService = {
  enrich: enrichClientContext,
};
