import { useState } from "react";
import { RefreshCw, Check, AlertCircle, X } from "lucide-react";

interface SyncStats {
  products: number;
  subjects: number;
  intents: number;
  articles: number;
  articleEmbeddings: number;
  problems: number;
  problemEmbeddings: number;
  problemProductLinks: number;
  actions: number;
  solutions: number;
  solutionActionLinks: number;
  rootCauses: number;
  rootCauseProblemLinks: number;
  rootCauseSolutionLinks: number;
}

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncModal({ isOpen, onClose }: SyncModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; stats?: SyncStats; error?: string } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/sync-from-prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, stats: data.stats });
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    if (!isSyncing) {
      setResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sincronizar de Produção
          </h2>
          <button
            onClick={handleClose}
            disabled={isSyncing}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!result && (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> Esta ação irá substituir os dados de configuração do ambiente de desenvolvimento pelos dados de produção.
                </p>
              </div>

              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">Tabelas que serão sincronizadas:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Produtos</li>
                  <li>Assuntos e Intenções</li>
                  <li>Artigos KB e Embeddings</li>
                  <li>Problemas e Embeddings</li>
                  <li>Ações e Soluções</li>
                  <li>Causas Raiz</li>
                </ul>
              </div>
            </>
          )}

          {result && result.success && result.stats && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">Sincronização concluída com sucesso!</span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Resumo:</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>Produtos: <strong>{result.stats.products}</strong></div>
                  <div>Assuntos: <strong>{result.stats.subjects}</strong></div>
                  <div>Intenções: <strong>{result.stats.intents}</strong></div>
                  <div>Artigos: <strong>{result.stats.articles}</strong></div>
                  <div>Embeddings Artigos: <strong>{result.stats.articleEmbeddings}</strong></div>
                  <div>Problemas: <strong>{result.stats.problems}</strong></div>
                  <div>Embeddings Problemas: <strong>{result.stats.problemEmbeddings}</strong></div>
                  <div>Ações: <strong>{result.stats.actions}</strong></div>
                  <div>Soluções: <strong>{result.stats.solutions}</strong></div>
                  <div>Causas Raiz: <strong>{result.stats.rootCauses}</strong></div>
                </div>
              </div>
            </div>
          )}

          {result && !result.success && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Erro na sincronização</p>
                <p className="text-sm mt-1">{result.error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          {!result ? (
            <>
              <button
                onClick={handleClose}
                disabled={isSyncing}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sincronizar
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
