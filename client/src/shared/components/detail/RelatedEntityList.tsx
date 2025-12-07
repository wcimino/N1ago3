import type { ReactNode } from "react";
import { LoadingState } from "../ui/LoadingSpinner";

interface RelatedEntityListProps<T> {
  title: string;
  icon: ReactNode;
  items: T[] | undefined;
  isLoading: boolean;
  emptyMessage?: string;
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string | number;
  onItemClick?: (item: T) => void;
}

export function RelatedEntityList<T>({
  title,
  icon,
  items,
  isLoading,
  emptyMessage = "Nenhum item encontrado",
  renderItem,
  keyExtractor,
  onItemClick,
}: RelatedEntityListProps<T>) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !items || items.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {items.map((item) => (
            <div
              key={keyExtractor(item)}
              className={`p-4 hover:bg-gray-50 ${onItemClick ? "cursor-pointer" : ""}`}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
