import { UserPlus, Loader2 } from "lucide-react";
import type { AddNewSyncStatus } from "./types";

interface AddNewSectionProps {
  addNewStatus: AddNewSyncStatus | undefined;
  onSyncNew: () => void;
  isSyncing: boolean;
  isPending: boolean;
}

export function AddNewSection({ addNewStatus, onSyncNew, isSyncing, isPending }: AddNewSectionProps) {
  if (addNewStatus?.isComplete) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">Carregar base completa</span>
      </div>
      <p className="text-xs text-blue-700">
        {addNewStatus?.hasStarted 
          ? `Continua de onde parou. Já processados: ${addNewStatus.lastSync?.recordsProcessed.toLocaleString("pt-BR") ?? 0} usuários.`
          : "Importa todos os usuários do Zendesk. Pode rodar em partes - cada execução continua de onde parou."}
      </p>
      <button
        onClick={onSyncNew}
        disabled={isSyncing || isPending}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            {addNewStatus?.hasStarted ? "Continuar importação" : "Adicionar novos usuários"}
          </>
        )}
      </button>
    </div>
  );
}
