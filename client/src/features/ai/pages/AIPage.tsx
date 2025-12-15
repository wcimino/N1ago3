import { useEffect } from "react";
import { useLocation } from "wouter";
import { FileText, Tags, MessageSquare, GraduationCap, Wrench, Settings, Lightbulb, Sparkles, Search, Zap } from "lucide-react";
import { PageHeader } from "../../../shared/components/ui";
import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";
import { ClassificationConfigPage } from "./ClassificationConfigPage";
import { ResponseConfigPage } from "./ResponseConfigPage";
import { LearningConfigPage } from "./LearningConfigPage";
import { EnrichmentConfigPage } from "./EnrichmentConfigPage";
import { DemandFinderConfigPage } from "./DemandFinderConfigPage";
import { SolutionProviderConfigPage } from "./SolutionProviderConfigPage";
import { ArticlesAndSolutionsConfigPage } from "./ArticlesAndSolutionsConfigPage";
import { ToolsPage } from "./ToolsPage";
import { GeneralSettingsPage } from "./GeneralSettingsPage";

import { BookOpen } from "lucide-react";

const agentTabs = [
  { id: "summary", label: "Resumo", icon: <FileText className="w-4 h-4" /> },
  { id: "classification", label: "Classificação", icon: <Tags className="w-4 h-4" /> },
  { id: "response", label: "Resposta", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "learning", label: "Aprendizado", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "enrichment", label: "Enriquecimento", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "demand_finder", label: "Demand Finder", icon: <Search className="w-4 h-4" /> },
  { id: "solution_provider", label: "Solution Provider", icon: <Zap className="w-4 h-4" /> },
  { id: "articles_and_solutions", label: "Artigos e Soluções", icon: <BookOpen className="w-4 h-4" /> },
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
    if (location.includes("/demand_finder")) return "demand_finder";
    if (location.includes("/solution_provider")) return "solution_provider";
    if (location.includes("/articles_and_solutions")) return "articles_and_solutions";
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
        {activeTab === "general" && <GeneralSettingsPage />}
        {activeTab === "summary" && <OpenaiSummaryConfigPage />}
        {activeTab === "classification" && <ClassificationConfigPage />}
        {activeTab === "response" && <ResponseConfigPage />}
        {activeTab === "learning" && <LearningConfigPage />}
        {activeTab === "enrichment" && <EnrichmentConfigPage />}
        {activeTab === "demand_finder" && <DemandFinderConfigPage />}
        {activeTab === "solution_provider" && <SolutionProviderConfigPage />}
        {activeTab === "articles_and_solutions" && <ArticlesAndSolutionsConfigPage />}
        {activeTab === "tools" && <ToolsPage />}
      </div>
    </div>
  );
}
