export interface DashboardProductItem {
  product: string;
  productId: number | null;
  count: number;
}

export interface DashboardEmotionItem {
  emotionLevel: number;
  count: number;
}

export interface DashboardProblemItem {
  problemName: string;
  count: number;
}

export interface DashboardHourlyItem {
  hour: number;
  isCurrentHour: boolean;
  isPast: boolean;
  todayCount: number;
  lastWeekCount: number;
}

export interface DashboardAnalyticsResponse {
  products: { items: DashboardProductItem[]; total: number };
  emotions: { items: DashboardEmotionItem[]; total: number };
  problems: { items: DashboardProblemItem[]; total: number };
  users: { total: number; authenticated: number; anonymous: number };
  hourly: DashboardHourlyItem[];
}
