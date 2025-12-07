import type { ReactNode } from "react";

export interface PageCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}

export function PageCard({ title, description, children, headerRight }: PageCardProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
