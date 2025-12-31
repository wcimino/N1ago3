import parquet from "parquetjs";

type ParquetSchema = ReturnType<typeof parquet.ParquetSchema>;

const schemas: Record<string, () => ParquetSchema> = {
  zendesk_conversations_webhook_raw: () =>
    new parquet.ParquetSchema({
      id: { type: "INT64" },
      source: { type: "UTF8", optional: true },
      received_at: { type: "UTF8", optional: true },
      source_ip: { type: "UTF8", optional: true },
      headers: { type: "UTF8", optional: true },
      payload: { type: "UTF8", optional: true },
      raw_body: { type: "UTF8", optional: true },
      processing_status: { type: "UTF8", optional: true },
      error_message: { type: "UTF8", optional: true },
      processed_at: { type: "UTF8", optional: true },
      retry_count: { type: "INT32", optional: true },
      events_created_count: { type: "INT32", optional: true },
    }),

  openai_api_logs: () =>
    new parquet.ParquetSchema({
      id: { type: "INT64" },
      request_type: { type: "UTF8", optional: true },
      model_name: { type: "UTF8", optional: true },
      prompt_system: { type: "UTF8", optional: true },
      prompt_user: { type: "UTF8", optional: true },
      response_raw: { type: "UTF8", optional: true },
      response_content: { type: "UTF8", optional: true },
      tokens_prompt: { type: "INT32", optional: true },
      tokens_completion: { type: "INT32", optional: true },
      tokens_total: { type: "INT32", optional: true },
      duration_ms: { type: "INT32", optional: true },
      success: { type: "BOOLEAN", optional: true },
      error_message: { type: "UTF8", optional: true },
      context_type: { type: "UTF8", optional: true },
      context_id: { type: "UTF8", optional: true },
      created_at: { type: "UTF8", optional: true },
    }),

  responses_suggested: () =>
    new parquet.ParquetSchema({
      id: { type: "INT64" },
      conversation_id: { type: "INT32", optional: true },
      external_conversation_id: { type: "UTF8", optional: true },
      suggested_response: { type: "UTF8", optional: true },
      last_event_id: { type: "INT32", optional: true },
      openai_log_id: { type: "INT32", optional: true },
      used_at: { type: "UTF8", optional: true },
      dismissed: { type: "BOOLEAN", optional: true },
      created_at: { type: "UTF8", optional: true },
      in_response_to: { type: "UTF8", optional: true },
      status: { type: "UTF8", optional: true },
      articles_used: { type: "UTF8", optional: true },
    }),
};

export function getParquetSchema(tableName: string): ParquetSchema {
  const schemaFactory = schemas[tableName];
  if (!schemaFactory) {
    throw new Error(`Unknown table for Parquet schema: ${tableName}`);
  }
  return schemaFactory();
}

export function getSchemaFields(tableName: string): string[] {
  const schema = getParquetSchema(tableName);
  return Object.keys((schema as any).schema);
}

export function serializeValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
