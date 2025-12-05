export interface OpenaiConfigResponse {
  id?: number;
  config_type: string;
  enabled: boolean;
  trigger_event_types: string[];
  trigger_author_types: string[];
  prompt_template: string;
  model_name: string;
  created_at?: string;
  updated_at?: string;
}

export type OpenaiSummaryConfigResponse = OpenaiConfigResponse;
