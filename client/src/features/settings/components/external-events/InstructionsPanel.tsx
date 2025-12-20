import { Download } from "lucide-react";

export function InstructionsPanel() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-blue-900 mb-2">Como usar</h4>
          <p className="text-sm text-blue-800 mb-2">
            Cadastre sistemas externos que podem enviar eventos para o Niago. 
            Cada sistema recebe uma chave de API única.
          </p>
          <p className="text-sm text-blue-800">
            <strong>Endpoint:</strong> <code className="bg-blue-100 px-1 rounded">POST /api/events/ingest</code>
          </p>
          <p className="text-sm text-blue-800">
            <strong>Header:</strong> <code className="bg-blue-100 px-1 rounded">X-API-Key: sua_chave</code>
          </p>
        </div>
        <a
          href="/api/docs/external-events-integration"
          download="n1ago-external-events-integration.md"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Baixar documentação
        </a>
      </div>
    </div>
  );
}
