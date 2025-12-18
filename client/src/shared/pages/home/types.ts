export interface OpenAIStatsResponse {
  last_24h: { 
    total_calls: number; 
    total_tokens: number; 
    estimated_cost: number;
    breakdown: Array<{ request_type: string; calls: number; cost: number }>;
    by_provider?: { openai: number; replit: number };
  };
}

export interface ProductItem {
  product: string;
  productId: number | null;
  count: number;
}
