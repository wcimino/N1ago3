import { useEffect } from "react";
import { useLocation } from "wouter";
import { FileText, Tags, MessageSquare, GraduationCap } from "lucide-react";
import { SegmentedTabs } from "../../../shared/components/ui";
import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";
import { ClassificationConfigPage } from "./ClassificationConfigPage";
import { ResponseConfigPage } from "./ResponseConfigPage";
import { LearningConfigPage } from "./LearningConfigPage";

const tabs = [
  { id: "summary", label: "Resumo", icon: <FileText className="w-4 h-4" /> },
  { id: "classification", label: "Classificação", icon: <Tags className="w-4 h-4" /> },
  { id: "response", label: "Resposta", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "learning", label: "Aprendizado", icon: <GraduationCap className="w-4 h-4" /> },
];

export function AIPage() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location === "/ai" || location === "/ai/" || location === "/ai/settings" || location === "/ai/settings/") {
      navigate("/ai/settings/summary", { replace: true });
    }
  }, [location, navigate]);

  const getActiveTab = () => {
    if (location.includes("/classification")) return "classification";
    if (location.includes("/response")) return "response";
    if (location.includes("/learning")) return "learning";
    return "summary";
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tabId: string) => {
    navigate(`/ai/settings/${tabId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Configuração de IA</h2>
        <p className="text-sm text-gray-500 mt-1">Configure as funcionalidades de inteligência artificial</p>
      </div>

      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </div>

      <div className="p-4">
        {activeTab === "summary" && <OpenaiSummaryConfigPage />}
        {activeTab === "classification" && <ClassificationConfigPage />}
        {activeTab === "response" && <ResponseConfigPage />}
        {activeTab === "learning" && <LearningConfigPage />}
      </div>
    </div>
  );
}
