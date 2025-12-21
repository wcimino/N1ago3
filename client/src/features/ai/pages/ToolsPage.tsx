import { useState } from "react";
import { KnowledgeBaseSearchTool } from "../components/KnowledgeBaseSearchTool";
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

      <ProblemObjectiveSearchTool
        isExpanded={expandedTool === "problem_objective"}
        onToggle={() => toggleTool("problem_objective")}
      />
    </div>
  );
}
