import { ReactNode } from "react";

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  actions,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      {actions && (
        <div className="flex items-center gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
