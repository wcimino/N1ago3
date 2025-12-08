import { useLocation } from "wouter";
import { Package, ArrowRight } from "lucide-react";

export function CatalogTab() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Produtos iFood Pago</h3>
              <p className="text-sm text-gray-600">Cadastre os produtos disponíveis para padronização e base de conhecimento</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/settings/ifood-products")}
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
