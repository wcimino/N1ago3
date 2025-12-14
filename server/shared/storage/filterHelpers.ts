import { eq, ilike, and, type SQL } from "drizzle-orm";

export interface FilterFieldConfig<TFilters> {
  filterKey: keyof TFilters;
  column: any;
  type: "eq" | "ilike" | "boolean";
}

export function buildFilterConditions<TFilters extends Record<string, any>>(
  filters: TFilters | undefined,
  config: FilterFieldConfig<TFilters>[]
): SQL[] {
  if (!filters) return [];

  const conditions: SQL[] = [];

  for (const { filterKey, column, type } of config) {
    const value = filters[filterKey];
    if (value === undefined || value === null || value === "") continue;

    switch (type) {
      case "eq":
        conditions.push(eq(column, value));
        break;
      case "ilike":
        conditions.push(ilike(column, `%${value}%`));
        break;
      case "boolean":
        if (typeof value === "boolean") {
          conditions.push(eq(column, value));
        }
        break;
    }
  }

  return conditions;
}

export function combineConditions(conditions: SQL[]): SQL | undefined {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}
