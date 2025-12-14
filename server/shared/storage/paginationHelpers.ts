import { db } from "../../db.js";
import { sql, desc, asc, count } from "drizzle-orm";
import type { PaginationParams, PaginatedResult } from "./types.js";

export interface PaginatedQueryConfig {
  table: any;
  orderByColumn?: any;
  orderDirection?: "asc" | "desc";
}

export async function paginatedQuery<TSelect>(
  config: PaginatedQueryConfig,
  whereClause: any | undefined,
  params: PaginationParams
): Promise<PaginatedResult<TSelect>> {
  const { table, orderByColumn, orderDirection = "desc" } = config;
  const { page = 1, limit = 20 } = params;

  const offset = (page - 1) * limit;

  const orderBy = orderByColumn
    ? orderDirection === "desc"
      ? desc(orderByColumn)
      : asc(orderByColumn)
    : undefined;

  let dataQuery = db.select().from(table);
  let countQuery = db.select({ count: count() }).from(table);

  if (whereClause) {
    dataQuery = dataQuery.where(whereClause) as any;
    countQuery = countQuery.where(whereClause) as any;
  }

  if (orderBy) {
    dataQuery = dataQuery.orderBy(orderBy) as any;
  }

  dataQuery = dataQuery.limit(limit).offset(offset) as any;

  const [data, countResult] = await Promise.all([
    dataQuery,
    countQuery,
  ]);

  const total = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(total / limit);

  return {
    data: data as TSelect[],
    total,
    page,
    limit,
    totalPages,
  };
}

export function calculatePagination(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}
