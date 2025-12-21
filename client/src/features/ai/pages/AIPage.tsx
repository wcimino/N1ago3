import { useEffect } from "react";
import { useLocation } from "wouter";
import { FileText, Tags, MessageSquare, Wrench, Sparkles, Search, BarChart3, CheckCircle } from "lucide-react";
import { PageHeader } from "../../../shared/components/ui";
import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";
import { ClassificationConfigPage } from "./ClassificationConfigPage";
import { ResponseConfigPage } from "./ResponseConfigPage";
import { DemandFinderConfigPage } from "./DemandFinderConfigPage";
import { TopicClassificationConfigPage } from "./TopicClassificationConfigPage";
import { CloserConfigPage } from "./CloserConfigPage";
import { ToolsPage } from "./ToolsPage";

const agentTabs = [
  { id: "summary", label: "Resumo", icon: <FileText className="w-4 h-4" /> },
  { id: "classification", label: "Classificação", icon: <Tags className="w-4 h-4" /> },
  { id: "demand_finder", label: "Demand Finder", icon: <Search className="w-4 h-4" /> },
  { id: "response", label: "Resposta", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "closer", label: "Closer", icon: <CheckCircle className="w-4 h-4" /> },
  { id: "topic_classification", label: "Temas", icon: <BarChart3 className="w-4 h-4" /> },
];

const utilityTabs = [
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
    if (location.includes("/topic_classification")) return "topic_classification";
    if (location.includes("/classification")) return "classification";
    if (location.includes("/response")) return "response";
    if (location.includes("/demand_finder")) return "demand_finder";
    if (location.includes("/closer")) return "closer";
    if (location.includes("/tools")) return "tools";
    if (location.includes("/summary")) return "summary";
    return "summary";
  };

  const activeTab = getActiveTab();
  const isUtilityTab = activeTab === "tools";

  const handleTabChange = (tabId: string) => {
    navigate(`/ai/settings/${tabId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <PageHeader
        title="Configuração de IA"
        icon={<Sparkles className="w-5 h-5" />}
        primaryTabs={utilityTabs}
        primaryActiveTab={isUtilityTab ? activeTab : ""}
        onPrimaryTabChange={handleTabChange}
        secondaryTabs={agentTabs}
        secondaryActiveTab={!isUtilityTab ? activeTab : ""}
        onSecondaryTabChange={handleTabChange}
      />

      <div className="p-4">
        {activeTab === "summary" && <OpenaiSummaryConfigPage />}
        {activeTab === "classification" && <ClassificationConfigPage />}
        {activeTab === "response" && <ResponseConfigPage />}
        {activeTab === "demand_finder" && <DemandFinderConfigPage />}
        {activeTab === "closer" && <CloserConfigPage />}
        {activeTab === "topic_classification" && <TopicClassificationConfigPage />}
        {activeTab === "tools" && <ToolsPage />}
      </div>
    </div>
  );
}
