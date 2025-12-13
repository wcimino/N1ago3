export interface ProductCount {
  product: string;
  productId: number | null;
  count: number;
}

export interface ProductStatsPeriod {
  items: ProductCount[];
  total: number;
}

export interface ProductStatsResponse {
  last_hour: ProductStatsPeriod;
  today: ProductStatsPeriod;
}

export interface EmotionCount {
  emotionLevel: number;
  count: number;
}

export interface EmotionStatsPeriod {
  items: EmotionCount[];
  total: number;
}

export interface EmotionStatsResponse {
  last_hour: EmotionStatsPeriod;
  today: EmotionStatsPeriod;
}

export interface ProblemCount {
  problemName: string;
  count: number;
}

export interface ProblemStatsPeriod {
  items: ProblemCount[];
  total: number;
}

export interface ProblemStatsResponse {
  last_hour: ProblemStatsPeriod;
  today: ProblemStatsPeriod;
}
