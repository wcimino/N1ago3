import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";

export function AIPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuração de IA</h1>
      </div>
      <OpenaiSummaryConfigPage />
    </div>
  );
}
