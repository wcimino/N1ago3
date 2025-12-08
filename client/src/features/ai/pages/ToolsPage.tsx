import { useState } from "react";
import { KnowledgeBaseSearchTool } from "../components/KnowledgeBaseSearchTool";
import { ProductCatalogSearchTool } from "../components/ProductCatalogSearchTool";

export function ToolsPage() {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const toggleTool = (tool: string) => {
    setExpandedTool(expandedTool === tool ? null : tool);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Ferramentas de IA</h3>
        <p className="text-sm text-blue-700">
          Use esta interface para testar as ferramentas disponíveis para os agentes de IA. 
          Essas mesmas funções são usadas automaticamente quando habilitadas nas configurações de cada agente.
        </p>
      </div>

      <KnowledgeBaseSearchTool
        isExpanded={expandedTool === "knowledge_base"}
        onToggle={() => toggleTool("knowledge_base")}
      />

      <ProductCatalogSearchTool
        isExpanded={expandedTool === "product_catalog"}
        onToggle={() => toggleTool("product_catalog")}
      />
    </div>
  );
}
