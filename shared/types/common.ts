export type AuthorType = "customer" | "agent" | "bot" | "system";

export interface PaginatedResponse<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}
