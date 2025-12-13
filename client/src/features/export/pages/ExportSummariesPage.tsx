import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Calendar, Target, Loader2, Tag } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import { formatDateTime } from "../../../lib/dateUtils";

interface SummaryExport {
  id: number;
  generatedAt: string;
  product: string | null;
  productStandard: string | null;
  intent: string | null;
  summary: string;
}

interface FilterOptions {
  products: string[];
  productStandards: string[];
  intents: string[];
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function escapeCsvField(field: string | null): string {
  if (field === null) return "";
  const escaped = field.replace(/"/g, '""');
  if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
    return `"${escaped}"`;
  }
  return escaped;
}

function downloadCsv(data: SummaryExport[], filename: string) {
  const headers = ["id", "timestamp", "produto", "produto_padronizado", "intencao", "resumo"];
  const rows = data.map((item) => [
    String(item.id),
    formatDateTime(item.generatedAt),
    escapeCsvField(item.product),
    escapeCsvField(item.productStandard),
    escapeCsvField(item.intent),
    escapeCsvField(item.summary),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportSummariesPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dateFrom, setDateFrom] = useState(formatDateForInput(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(formatDateForInput(today));
  const [productStandard, setProductStandard] = useState("");
  const [intent, setIntent] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["export-filters"],
    queryFn: () => fetchApi<FilterOptions>("/api/export/filters"),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (productStandard) params.append("productStandard", productStandard);
      if (intent) params.append("intent", intent);

      const data = await fetchApi<SummaryExport[]>(`/api/export/summaries?${params.toString()}`);
      
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadCsv(data, `resumos_${timestamp}.csv`);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Data Início
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Data Fim
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Tag className="w-4 h-4 inline mr-1" />
              Produto Padronizado
            </label>
            <select
              value={productStandard}
              onChange={(e) => setProductStandard(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {filterOptions?.productStandards.map((ps) => (
                <option key={ps} value={ps}>
                  {ps}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Target className="w-4 h-4 inline mr-1" />
              Intenção
            </label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas</option>
              {filterOptions?.intents.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Campos exportados</h3>
        <p className="text-sm text-gray-500">
          O arquivo CSV incluirá: <strong>id</strong>, <strong>timestamp</strong>, <strong>produto</strong>, <strong>produto_padronizado</strong>, <strong>intenção</strong> e <strong>resumo</strong>.
        </p>
      </div>
    </div>
  );
}
