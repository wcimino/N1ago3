import type { ReactNode } from "react";

export interface SummaryCardItemProps {
  icon: ReactNode;
  title: string;
  content: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}

export function SummaryCardItem({ icon, title, content, bgColor, borderColor, iconColor }: SummaryCardItemProps) {
  return (
    <div className={`rounded-lg p-3 ${bgColor} border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={iconColor}>{icon}</div>
        <h4 className="font-medium text-gray-800 text-sm">{title}</h4>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
    </div>
  );
}
