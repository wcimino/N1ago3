import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";
import { ClassificationConfigPage } from "./ClassificationConfigPage";
import { ResponseConfigPage } from "./ResponseConfigPage";

export function AIPage() {
  const [location, setLocation] = useLocation();
  
  const isSummary = location === "/ai" || location === "/ai/" || location === "/ai/settings/summary";
  const isClassification = location === "/ai/settings/classification";
  const isResponse = location === "/ai/settings/response";

  useEffect(() => {
    if (location === "/ai" || location === "/ai/") {
      setLocation("/ai/settings/summary", { replace: true });
    }
  }, [location, setLocation]);

  const CurrentPage = useMemo(() => {
    if (isClassification) return ClassificationConfigPage;
    if (isResponse) return ResponseConfigPage;
    return OpenaiSummaryConfigPage;
  }, [isClassification, isResponse]);

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Configuração de IA</h1>
        <div className="border-b border-gray-200 -mx-3 px-3 sm:mx-0 sm:px-0">
          <nav className="flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide pb-px" aria-label="Tabs">
            <Link
              href="/ai/settings/summary"
              className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                isSummary
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Resumo
            </Link>
            <Link
              href="/ai/settings/classification"
              className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                isClassification
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Classificação
            </Link>
            <Link
              href="/ai/settings/response"
              className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                isResponse
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Resposta
            </Link>
          </nav>
        </div>
      </div>
      <CurrentPage />
    </div>
  );
}
