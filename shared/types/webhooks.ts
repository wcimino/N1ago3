export interface WebhookLog {
  id: number;
  received_at: string;
  source_ip: string;
  processing_status: string;
  error_message: string | null;
  processed_at: string | null;
}

export interface WebhookLogDetail {
  id: number;
  received_at: string;
  source_ip: string;
  headers: Record<string, string>;
  payload: any;
  raw_body: string;
  processing_status: string;
  error_message: string | null;
  processed_at: string | null;
}

export interface WebhookLogsResponse {
  total: number;
  offset: number;
  limit: number;
  logs: WebhookLog[];
}

export interface WebhookStatsResponse {
  total: number;
  by_status: Record<string, number>;
}
