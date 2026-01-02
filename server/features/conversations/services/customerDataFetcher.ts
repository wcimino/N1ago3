import { fetchClientByAccountRef } from "../../../shared/services/clientHubClient.js";
import type { ClientHubData } from "../../../../shared/schema/clientHub.js";

export interface CustomerDataResult {
  status: "success" | "not_found" | "error" | "skipped";
  payload?: ClientHubData;
  error?: string;
}

export async function fetchCustomerData(params: {
  accountRef?: string;
  conversationId: number;
}): Promise<CustomerDataResult> {
  const { accountRef, conversationId } = params;

  if (!accountRef) {
    console.log(`[CustomerDataFetcher] No accountRef provided for conversation ${conversationId}, skipping ClientHub fetch`);
    return { status: "skipped" };
  }

  try {
    const clientData = await fetchClientByAccountRef(accountRef, { conversationId });

    if (clientData) {
      console.log(`[CustomerDataFetcher] Successfully fetched data for conversation ${conversationId}`);
      return {
        status: "success",
        payload: clientData,
      };
    } else {
      console.log(`[CustomerDataFetcher] No data found for conversation ${conversationId}, accountRef: ${accountRef}`);
      return { status: "not_found" };
    }
  } catch (error) {
    console.error(`[CustomerDataFetcher] Error fetching data for conversation ${conversationId}:`, error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
