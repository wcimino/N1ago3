import { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { LoadingState } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  pagination?: {
    page: number;
    totalPages: number;
    showingFrom: number;
    showingTo: number;
    total: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    itemLabel?: string;
  };
  onRowClick?: (item: T) => void;
  sortColumn?: string;
  onSort?: (column: string) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription,
  emptyIcon,
  pagination,
  onRowClick,
  sortColumn,
  onSort,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (data.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase ${column.className || ""}`}
                  onClick={column.sortable && onSort ? () => onSort(column.key) : undefined}
                  style={column.sortable ? { cursor: "pointer" } : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.header}
                    {sortColumn === column.key && <ArrowDown className="w-3 h-3" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`hover:bg-gray-50 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 ${column.className || ""}`}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          showingFrom={pagination.showingFrom}
          showingTo={pagination.showingTo}
          total={pagination.total}
          onPreviousPage={pagination.onPreviousPage}
          onNextPage={pagination.onNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          hasNextPage={pagination.hasNextPage}
          itemLabel={pagination.itemLabel}
        />
      )}
    </>
  );
}
