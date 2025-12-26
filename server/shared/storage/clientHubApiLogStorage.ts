import { db } from "../../db.js";
import { clientHubApiLogs, InsertClientHubApiLog } from "../../../shared/schema/clientHub.js";

export interface ClientHubLogRequest {
  conversationId?: number;
  accountRef?: string;
  requestUrl: string;
  responseStatus?: number;
  responseData?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export const clientHubApiLogStorage = {
  async logRequest(data: ClientHubLogRequest): Promise<void> {
    const insertData: InsertClientHubApiLog = {
      conversationId: data.conversationId,
      accountRef: data.accountRef,
      requestUrl: data.requestUrl,
      responseStatus: data.responseStatus,
      responseData: data.responseData,
      success: data.success,
      errorMessage: data.errorMessage,
      durationMs: data.durationMs,
    };

    await db.insert(clientHubApiLogs).values(insertData);
  },
};
