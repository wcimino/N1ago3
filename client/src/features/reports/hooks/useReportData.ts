import { useQuery } from "@tanstack/react-query";

export type PeriodFilter = "1h" | "24h" | "all";

export const periodLabels: Record<PeriodFilter, string> = {
  "1h": "Última 1h",
  "24h": "Últimas 24h",
  "all": "Todo período",
};

interface UseReportDataOptions<T> {
  endpoint: string;
  period: PeriodFilter;
  queryKey: string;
}

export function useReportData<T>({ endpoint, period, queryKey }: UseReportDataOptions<T>) {
  return useQuery<T[]>({
    queryKey: ["reports", queryKey, period],
    queryFn: async () => {
      const response = await fetch(`${endpoint}?period=${period}`);
      if (!response.ok) throw new Error("Falha ao carregar relatório");
      return response.json();
    },
  });
}
