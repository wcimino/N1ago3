import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight as ArrowRight } from "lucide-react";

interface StatsCardProps {
  title: string;
  icon: ReactNode;
  linkTo?: string;
  linkText?: string;
  badge?: string;
  className?: string;
  children: ReactNode;
}

export function StatsCard({ title, icon, linkTo, linkText = "Ver", badge, className, children }: StatsCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-5 flex flex-col h-full ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
          {badge && (
            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </h2>
        {linkTo && (
          <Link href={linkTo} className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
            {linkText} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
