import { useLocation } from "wouter";
import { Users, Settings, Wrench, FileEdit, Database } from "lucide-react";
import { SegmentedTabs } from "../../../shared/components/ui";
import { AccessControlTab } from "../components/AccessControlTab";
import { GeneralSettingsTab } from "../components/GeneralSettingsTab";
import { MaintenanceTab } from "../components/MaintenanceTab";
import { CatalogTab } from "../components/CatalogTab";
import { ExternalDataTab } from "../components/ExternalDataTab";

type TabId = "access" | "general" | "catalog" | "maintenance" | "external-data";

const tabs = [
  { id: "access", label: "Acessos", icon: <Users className="w-4 h-4" /> },
  { id: "general", label: "Geral", icon: <Settings className="w-4 h-4" /> },
  { id: "catalog", label: "Cadastro", icon: <FileEdit className="w-4 h-4" /> },
  { id: "maintenance", label: "Manutenção", icon: <Wrench className="w-4 h-4" /> },
  { id: "external-data", label: "Dados externos", icon: <Database className="w-4 h-4" /> },
];

const tabPaths: Record<TabId, string> = {
  access: "/settings/access",
  general: "/settings/general",
  catalog: "/settings/catalog",
  maintenance: "/settings/maintenance",
  "external-data": "/settings/external-data",
};

interface SettingsPageProps {
  activeTab?: TabId;
}

export function SettingsPage({ activeTab = "access" }: SettingsPageProps) {
  const [, navigate] = useLocation();

  const handleTabChange = (tabId: string) => {
    navigate(tabPaths[tabId as TabId]);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </div>

      <div className="p-4">
        {activeTab === "access" && <AccessControlTab />}
        {activeTab === "general" && <GeneralSettingsTab />}
        {activeTab === "catalog" && <CatalogTab />}
        {activeTab === "maintenance" && <MaintenanceTab />}
        {activeTab === "external-data" && <ExternalDataTab />}
      </div>
    </div>
  );
}
