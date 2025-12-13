import { useState } from "react";
import { KnowledgeBaseSearchTool } from "../components/KnowledgeBaseSearchTool";
import { ProductCatalogSearchTool } from "../components/ProductCatalogSearchTool";
import { ZendeskKnowledgeBaseSearchTool } from "../components/ZendeskKnowledgeBaseSearchTool";
import { ProblemObjectiveSearchTool } from "../components/ProblemObjectiveSearchTool";
import { CombinedKnowledgeSearchTool } from "../components/CombinedKnowledgeSearchTool";

export function ToolsPage() {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const toggleTool = (tool: string) => {
    setExpandedTool(expandedTool === tool ? null : tool);
  };

  return (
    <div className="space-y-6">
      <CombinedKnowledgeSearchTool
        isExpanded={expandedTool === "combined_search"}
        onToggle={() => toggleTool("combined_search")}
      />

      <KnowledgeBaseSearchTool
        isExpanded={expandedTool === "knowledge_base"}
        onToggle={() => toggleTool("knowledge_base")}
      />

      <ProductCatalogSearchTool
        isExpanded={expandedTool === "product_catalog"}
        onToggle={() => toggleTool("product_catalog")}
      />

      <ZendeskKnowledgeBaseSearchTool
        isExpanded={expandedTool === "zendesk_knowledge_base"}
        onToggle={() => toggleTool("zendesk_knowledge_base")}
      />

      <ProblemObjectiveSearchTool
        isExpanded={expandedTool === "problem_objective"}
        onToggle={() => toggleTool("problem_objective")}
      />
    </div>
  );
}
