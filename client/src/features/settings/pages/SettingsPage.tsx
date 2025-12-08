import { useLocation } from "wouter";
import { Users, Settings, Wrench, FileEdit } from "lucide-react";
import { AccessControlTab } from "../components/AccessControlTab";
import { GeneralSettingsTab } from "../components/GeneralSettingsTab";
import { MaintenanceTab } from "../components/MaintenanceTab";
import { CatalogTab } from "../components/CatalogTab";

type TabId = "access" | "general" | "catalog" | "maintenance";

interface Tab {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  path: string;
}

const tabs: Tab[] = [
  { id: "access", label: "Controle de Acessos", shortLabel: "Acessos", icon: <Users className="w-4 h-4" />, path: "/settings/access" },
  { id: "general", label: "Configurações Gerais", shortLabel: "Geral", icon: <Settings className="w-4 h-4" />, path: "/settings/general" },
  { id: "catalog", label: "Cadastro", shortLabel: "Cadastro", icon: <FileEdit className="w-4 h-4" />, path: "/settings/catalog" },
  { id: "maintenance", label: "Manutenção", shortLabel: "Manutenção", icon: <Wrench className="w-4 h-4" />, path: "/settings/maintenance" },
];

interface SettingsPageProps {
  activeTab?: TabId;
}

export function SettingsPage({ activeTab = "access" }: SettingsPageProps) {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="border-b overflow-x-auto">
          <nav className="flex gap-1 p-2 min-w-max" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }
                `}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "access" && <AccessControlTab />}
          {activeTab === "general" && <GeneralSettingsTab />}
          {activeTab === "catalog" && <CatalogTab />}
          {activeTab === "maintenance" && <MaintenanceTab />}
        </div>
      </div>
    </div>
  );
}
