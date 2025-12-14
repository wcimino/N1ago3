import type { SQL } from "drizzle-orm";

export interface BaseFilters {
  search?: string;
  isActive?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FilterBuilder<TFilters extends BaseFilters> = (
  filters: TFilters
) => SQL[];

export interface CrudStorageConfig<TTable, TSelect, TInsert, TFilters extends BaseFilters = BaseFilters> {
  table: TTable;
  idField: keyof TSelect;
  searchField?: keyof TSelect;
  isActiveField?: keyof TSelect;
  updatedAtField?: keyof TSelect;
  defaultOrderBy?: "asc" | "desc";
}
