import { CheckCircle2 } from "lucide-react";
import type { FormResponsePayload } from "./types";

interface FormResponseContentProps {
  payload: FormResponsePayload;
}

export function FormResponseContent({ payload }: FormResponseContentProps) {
  if (payload.textFallback) {
    return (
      <div className="text-sm text-gray-800">
        <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Resposta do formulário</span>
        </div>
        <p className="whitespace-pre-wrap break-words">{payload.textFallback}</p>
      </div>
    );
  }

  if (!payload.fields?.length) {
    return (
      <div className="text-sm text-gray-800">
        <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Resposta do formulário</span>
        </div>
        <p className="text-gray-500 italic">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-800">
      <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
        <CheckCircle2 className="w-4 h-4" />
        <span>Resposta do formulário</span>
      </div>
      <div className="space-y-1">
        {payload.fields.map((field, idx) => (
          <div key={idx}>
            <span className="text-gray-500 text-xs">{field.label}:</span>
            <p className="whitespace-pre-wrap break-words">{field.text || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
