export type PeriodFilter = "1h" | "24h" | "all";

export function getPeriodDateFilter(period: PeriodFilter, tableAlias: string = "cs"): string {
  switch (period) {
    case "1h":
      return `AND ${tableAlias}.created_at >= NOW() - INTERVAL '1 hour'`;
    case "24h":
      return `AND ${tableAlias}.created_at >= NOW() - INTERVAL '24 hours'`;
    case "all":
    default:
      return "";
  }
}

export function validatePeriod(period: string | undefined): PeriodFilter {
  if (period === "1h" || period === "24h" || period === "all") {
    return period;
  }
  return "all";
}
