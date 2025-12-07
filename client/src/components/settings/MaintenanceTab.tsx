import { useLocation } from "wouter";
import { Package, ArrowRight, RefreshCw } from "lucide-react";

export function MaintenanceTab() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Padronização de Produtos</h3>
            <p className="text-sm text-gray-600">Defina nomes padronizados para os produtos classificados pela IA</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/settings/product-standards")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Começar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reprocessamento de Dados</h3>
            <p className="text-sm text-gray-600">Reprocesse webhooks para atualizar dados de usuários e organizações</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/settings/reprocessing")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Começar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
