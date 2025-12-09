import { useEffect } from "react";
import { useLocation } from "wouter";
import { FileText, Tags, MessageSquare, GraduationCap, Wrench, Settings, Lightbulb } from "lucide-react";
import { SegmentedTabs } from "../../../shared/components/ui";
import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";
import { ClassificationConfigPage } from "./ClassificationConfigPage";
import { ResponseConfigPage } from "./ResponseConfigPage";
import { LearningConfigPage } from "./LearningConfigPage";
import { EnrichmentConfigPage } from "./EnrichmentConfigPage";
import { ToolsPage } from "./ToolsPage";
import { GeneralSettingsPage } from "./GeneralSettingsPage";

const agentTabs = [
  { id: "summary", label: "Resumo", icon: <FileText className="w-4 h-4" /> },
  { id: "classification", label: "Classificação", icon: <Tags className="w-4 h-4" /> },
  { id: "response", label: "Resposta", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "learning", label: "Aprendizado", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "enrichment", label: "Enriquecimento", icon: <Lightbulb className="w-4 h-4" /> },
];

const utilityTabs = [
  { id: "general", label: "Configurações", icon: <Settings className="w-4 h-4" /> },
  { id: "tools", label: "Ferramentas", icon: <Wrench className="w-4 h-4" /> },
];

export function AIPage() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location === "/ai" || location === "/ai/" || location === "/ai/settings" || location === "/ai/settings/") {
      navigate("/ai/settings/summary", { replace: true });
    }
  }, [location, navigate]);

  const getActiveTab = () => {
    if (location.includes("/general")) return "general";
    if (location.includes("/classification")) return "classification";
    if (location.includes("/response")) return "response";
    if (location.includes("/learning")) return "learning";
    if (location.includes("/enrichment")) return "enrichment";
    if (location.includes("/tools")) return "tools";
    if (location.includes("/summary")) return "summary";
    return "summary";
  };

  const activeTab = getActiveTab();
  const isUtilityTab = activeTab === "general" || activeTab === "tools";

  const handleTabChange = (tabId: string) => {
    navigate(`/ai/settings/${tabId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Configuração de IA</h2>
        </div>
        <div className="shrink-0">
          <SegmentedTabs
            tabs={utilityTabs}
            activeTab={isUtilityTab ? activeTab : ""}
            onChange={handleTabChange}
          />
        </div>
      </div>

      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={agentTabs}
          activeTab={!isUtilityTab ? activeTab : ""}
          onChange={handleTabChange}
        />
      </div>

      <div className="p-4">
        {activeTab === "general" && <GeneralSettingsPage />}
        {activeTab === "summary" && <OpenaiSummaryConfigPage />}
        {activeTab === "classification" && <ClassificationConfigPage />}
        {activeTab === "response" && <ResponseConfigPage />}
        {activeTab === "learning" && <LearningConfigPage />}
        {activeTab === "enrichment" && <EnrichmentConfigPage />}
        {activeTab === "tools" && <ToolsPage />}
      </div>
    </div>
  );
}
