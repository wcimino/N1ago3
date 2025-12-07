import type { ReactNode } from "react";

interface InfoFieldProps {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}

export function InfoField({ icon, label, value }: InfoFieldProps) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="w-5 h-5 text-gray-400 mt-0.5 flex items-center justify-center">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium">{value || "-"}</p>
      </div>
    </div>
  );
}
