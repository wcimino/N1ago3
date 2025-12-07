import { useState } from "react";
import { Users, Settings, Wrench } from "lucide-react";
import { AccessControlTab } from "../components/AccessControlTab";
import { GeneralSettingsTab } from "../components/GeneralSettingsTab";
import { MaintenanceTab } from "../components/MaintenanceTab";

type TabId = "access-control" | "general" | "maintenance";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "access-control", label: "Controle de Acessos", icon: <Users className="w-4 h-4" /> },
  { id: "general", label: "Configurações Gerais", icon: <Settings className="w-4 h-4" /> },
  { id: "maintenance", label: "Manutenção", icon: <Wrench className="w-4 h-4" /> },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("access-control");

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="border-b overflow-x-auto">
          <nav className="flex gap-1 p-2 min-w-max" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
                <span className="sm:hidden">
                  {tab.id === "access-control" && "Acessos"}
                  {tab.id === "general" && "Geral"}
                  {tab.id === "maintenance" && "Manutenção"}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "access-control" && <AccessControlTab />}
          {activeTab === "general" && <GeneralSettingsTab />}
          {activeTab === "maintenance" && <MaintenanceTab />}
        </div>
      </div>
    </div>
  );
}
