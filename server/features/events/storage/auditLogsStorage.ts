import { db } from "../../../db.js";
import { externalEventAuditLogs, type InsertExternalEventAuditLog } from "../../../../shared/schema/events.js";

export const auditLogsStorage = {
  async log(data: InsertExternalEventAuditLog): Promise<void> {
    try {
      await db.insert(externalEventAuditLogs).values(data);
    } catch (error) {
      console.error("[AuditLogs] Error logging audit entry:", error);
    }
  },

  getApiKeyPrefix(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) return "***";
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  },
};
