import { pgTable, serial, text, timestamp, json, integer, boolean, index } from "drizzle-orm/pg-core";

export interface ClientHubField {
  label: string;
  value: string;
  dataType: string;
  category: string;
}

export interface ClientHubData {
  cnpj?: string;
  cnpjValido?: boolean;
  campos?: Record<string, ClientHubField>;
  fetchedAt?: string;
}

export const clientHubApiLogs = pgTable("client_hub_api_logs", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  accountRef: text("account_ref"),
  requestUrl: text("request_url").notNull(),
  responseStatus: integer("response_status"),
  responseData: json("response_data"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("idx_client_hub_api_logs_conversation_id").on(table.conversationId),
  accountRefIdx: index("idx_client_hub_api_logs_account_ref").on(table.accountRef),
  createdAtIdx: index("idx_client_hub_api_logs_created_at").on(table.createdAt),
}));

export type ClientHubApiLog = typeof clientHubApiLogs.$inferSelect;
export type InsertClientHubApiLog = Omit<typeof clientHubApiLogs.$inferInsert, "id" | "createdAt">;
