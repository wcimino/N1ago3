import { CheckCircle, AlertCircle } from "lucide-react";
import { SyncResult } from "../types/zendesk";

interface SyncStatusBannerProps {
  isSuccess: boolean;
  isError: boolean;
  data?: SyncResult;
  errorMessage?: string;
}

export function SyncStatusBanner({ isSuccess, isError, data, errorMessage }: SyncStatusBannerProps) {
  if (isSuccess && data) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <CheckCircle className="w-4 h-4" />
          Sincronização concluída
        </div>
        <div className="mt-1 text-green-600">
          {data.articlesCreated} novos, {data.articlesUpdated} atualizados
          ({data.articlesTotal} total)
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-red-700 font-medium">
          <AlertCircle className="w-4 h-4" />
          Erro ao sincronizar artigos
        </div>
        <div className="mt-1 text-red-600">
          {errorMessage || "Verifique as credenciais do Zendesk."}
        </div>
      </div>
    );
  }

  return null;
}
