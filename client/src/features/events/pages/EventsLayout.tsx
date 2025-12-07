import { useEffect } from "react";
import { useLocation } from "wouter";
import { List, Database, Settings } from "lucide-react";
import { SegmentedTabs } from "../../../shared/components/ui";
import { EventsStandardPage } from "./EventsStandardPage";
import { ZendeskConversationsRawPage } from "../../conversations";
import { EventTypeMappingsPage } from "./EventTypeMappingsPage";

const tabs = [
  { id: "events_standard", label: "Padronizados", icon: <List className="w-4 h-4" /> },
  { id: "zendesk_conversations_raw", label: "Zendesk Raw", icon: <Database className="w-4 h-4" /> },
  { id: "config", label: "Config.", icon: <Settings className="w-4 h-4" /> },
];

export function EventsLayout() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location === "/settings/events" || location === "/settings/events/") {
      navigate("/settings/events/events_standard", { replace: true });
    }
  }, [location, navigate]);

  const getActiveTab = () => {
    if (location.includes("/zendesk_conversations_raw")) return "zendesk_conversations_raw";
    if (location.includes("/config")) return "config";
    return "events_standard";
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tabId: string) => {
    navigate(`/settings/events/${tabId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Eventos</h2>
        <p className="text-sm text-gray-500 mt-1">Visualize e configure os eventos do sistema</p>
      </div>

      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </div>

      <div className="p-4">
        {activeTab === "events_standard" && <EventsStandardPage />}
        {activeTab === "zendesk_conversations_raw" && <ZendeskConversationsRawPage />}
        {activeTab === "config" && <EventTypeMappingsPage />}
      </div>
    </div>
  );
}
