export const ROTATION_WARNING_DAYS = 90;

export interface ExternalEventSource {
  id: number;
  name: string;
  source: string;
  channel_type: string;
  api_key?: string;
  api_key_masked?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  last_rotated_at?: string;
}

export interface ExternalEventSourcesResponse {
  sources: ExternalEventSource[];
}
