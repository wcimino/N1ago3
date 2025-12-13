import { RefreshCw } from "lucide-react";

export function LoadingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  );
}
