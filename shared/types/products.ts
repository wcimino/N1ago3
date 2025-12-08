export interface ProductCount {
  product: string;
  count: number;
}

export interface ProductStatsResponse {
  last_hour: ProductCount[];
  today: ProductCount[];
}

export interface EmotionCount {
  emotionLevel: number;
  count: number;
}

export interface EmotionStatsResponse {
  last_hour: EmotionCount[];
  today: EmotionCount[];
}
