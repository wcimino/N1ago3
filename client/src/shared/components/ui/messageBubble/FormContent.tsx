import { ClipboardList } from "lucide-react";
import type { FormPayload } from "./types";

interface FormContentProps {
  payload: FormPayload;
}

export function FormContent({ payload }: FormContentProps) {
  return (
    <div className="text-sm text-gray-800">
      <div className="flex items-center gap-1.5 text-blue-600 font-medium mb-1">
        <ClipboardList className="w-4 h-4" />
        <span>Formulário</span>
      </div>
      <div className="space-y-1 text-gray-600 italic">
        {payload.fields.map((field, idx) => (
          <p key={idx}>{field.label}</p>
        ))}
      </div>
    </div>
  );
}
