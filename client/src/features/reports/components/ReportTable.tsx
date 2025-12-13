import { RefreshCw, AlertCircle } from "lucide-react";
import { Pagination } from "../../../shared/components/ui/Pagination";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "right" | "center";
  render?: (value: any, row: T) => React.ReactNode;
}

interface ReportTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  page?: number;
  totalPages?: number;
  total?: number;
  showingFrom?: number;
  showingTo?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
}

export function ReportTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  isLoading,
  isError,
  error,
  onRetry,
  page = 0,
  totalPages = 1,
  total = 0,
  showingFrom = 0,
  showingTo = 0,
  onPreviousPage,
  onNextPage,
  hasPreviousPage = false,
  hasNextPage = false,
}: ReportTableProps<T>) {
  const alignClass = (align?: "left" | "right" | "center") => {
    switch (align) {
      case "right": return "text-right";
      case "center": return "text-center";
      default: return "text-left";
    }
  };

  const showPagination = total > 0 && onPreviousPage && onNextPage;

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 text-red-600">
          <AlertCircle className="w-8 h-8 mb-2" />
          <p className="font-medium">Erro ao carregar relatório</p>
          <p className="text-sm text-gray-500 mt-1">
            {error instanceof Error ? error.message : "Tente novamente"}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Nenhum dado encontrado
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  {columns.map((col) => (
                    <th
                      key={String(col.key)}
                      className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${alignClass(col.align)}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {columns.map((col) => {
                      const value = row[col.key as keyof T];
                      return (
                        <td
                          key={String(col.key)}
                          className={`px-6 py-4 whitespace-nowrap text-sm ${alignClass(col.align)} ${col.align === "right" ? "font-medium text-gray-900" : "text-gray-600"}`}
                        >
                          {col.render ? col.render(value, row) : (value ?? "-")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showPagination && (
            <Pagination
              page={page}
              totalPages={totalPages}
              showingFrom={showingFrom}
              showingTo={showingTo}
              total={total}
              onPreviousPage={onPreviousPage}
              onNextPage={onNextPage}
              hasPreviousPage={hasPreviousPage}
              hasNextPage={hasNextPage}
              itemLabel="registros"
            />
          )}
        </>
      )}
    </div>
  );
}
