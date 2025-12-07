import { ChevronLeft } from "lucide-react";

interface DetailPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export function DetailPageHeader({ title, subtitle, onBack }: DetailPageHeaderProps) {
  return (
    <div className="px-4 py-3 border-b flex items-center gap-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}
