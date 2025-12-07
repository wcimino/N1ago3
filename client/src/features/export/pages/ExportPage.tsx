import { useEffect } from "react";
import { useLocation } from "wouter";
import { Download } from "lucide-react";
import { SegmentedTabs } from "../../../shared/components/ui";
import { ExportSummariesPage } from "./ExportSummariesPage";

const tabs = [
  { id: "summaries", label: "Resumos", icon: <Download className="w-4 h-4" /> },
];

export function ExportPage() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location === "/export" || location === "/export/") {
      navigate("/export/summaries", { replace: true });
    }
  }, [location, navigate]);

  const getActiveTab = () => {
    if (location.includes("/summaries")) return "summaries";
    return "summaries";
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tabId: string) => {
    navigate(`/export/${tabId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Exportações</h2>
        <p className="text-sm text-gray-500 mt-1">Exporte dados do sistema</p>
      </div>

      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </div>

      <div className="p-4">
        {activeTab === "summaries" && <ExportSummariesPage />}
      </div>
    </div>
  );
}
