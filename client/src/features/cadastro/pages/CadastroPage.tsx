import { useLocation } from "wouter";
import { Users, Building2 } from "lucide-react";
import { SegmentedTabs } from "../../../shared/components/SegmentedTabs";
import { UsersListContent } from "./UsersListContent";
import { OrganizationsListContent } from "./OrganizationsListContent";

interface CadastroPageProps {
  activeTab?: "usuarios" | "organizacoes";
}

export function CadastroPage({ activeTab = "usuarios" }: CadastroPageProps) {
  const [, navigate] = useLocation();

  const tabs = [
    { id: "usuarios", label: "Usuários", icon: <Users className="w-4 h-4" /> },
    { id: "organizacoes", label: "Organizações", icon: <Building2 className="w-4 h-4" /> },
  ];

  const handleTabChange = (tabId: string) => {
    if (tabId === "usuarios") {
      navigate("/cadastro");
    } else {
      navigate("/cadastro/organizacoes");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Cadastro</h2>
        <p className="text-sm text-gray-500 mt-1">Gestão de usuários e organizações</p>
      </div>

      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </div>

      {activeTab === "usuarios" ? (
        <UsersListContent />
      ) : (
        <OrganizationsListContent />
      )}
    </div>
  );
}
