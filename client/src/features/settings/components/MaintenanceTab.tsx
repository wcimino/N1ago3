import { useLocation } from "wouter";
import { Package, ArrowRight, RefreshCw, Activity, MessageSquareX, Download, Copy } from "lucide-react";

export function MaintenanceTab() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Padronização de Produtos</h3>
              <p className="text-sm text-gray-600">Defina nomes padronizados para os produtos classificados pela IA</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/product-standards")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0 w-full sm:w-auto"
          >
            Acessar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Reprocessamento de Dados</h3>
              <p className="text-sm text-gray-600">Reprocesse webhooks para atualizar dados de usuários e organizações</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/reprocessing")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0 w-full sm:w-auto"
          >
            Acessar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Eventos</h3>
              <p className="text-sm text-gray-600">Visualize e gerencie eventos padronizados e webhooks</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/events")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0 w-full sm:w-auto"
          >
            Acessar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <MessageSquareX className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Encerramento de Conversas</h3>
              <p className="text-sm text-gray-600">Controle o encerramento automático de conversas inativas</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/auto-close")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0 w-full sm:w-auto"
          >
            Acessar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Exportações</h3>
              <p className="text-sm text-gray-600">Exporte dados de conversas e atendimentos</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/maintenance/export")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0 w-full sm:w-auto"
          >
            Acessar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <Copy className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Limpeza de Duplicados</h3>
              <p className="text-sm text-gray-600">Identifique e remova eventos duplicados do banco de dados</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/maintenance/duplicates")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0 w-full sm:w-auto"
          >
            Acessar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
