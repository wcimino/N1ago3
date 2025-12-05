import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { EventsStandardPage } from "./EventsStandardPage";
import { ZendeskConversationsRawPage } from "./ZendeskConversationsRawPage";
import { EventTypeMappingsPage } from "./EventTypeMappingsPage";

export function EventsLayout() {
  const [location, setLocation] = useLocation();
  
  const isEventsStandard = location === "/events" || location === "/events/" || location.startsWith("/events/events_standard");
  const isZendeskRaw = location.startsWith("/events/zendesk_conversations_raw");
  const isSettings = location.startsWith("/events/settings");

  useEffect(() => {
    if (location === "/events" || location === "/events/") {
      setLocation("/events/events_standard", { replace: true });
    }
  }, [location, setLocation]);

  const CurrentPage = useMemo(() => {
    if (isZendeskRaw) return ZendeskConversationsRawPage;
    if (isSettings) return EventTypeMappingsPage;
    return EventsStandardPage;
  }, [isZendeskRaw, isSettings]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Eventos</h1>
        <div className="border-b border-gray-200">
          <nav className="flex gap-4" aria-label="Tabs">
            <Link
              href="/events/events_standard"
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                isEventsStandard
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Eventos padronizados
            </Link>
            <Link
              href="/events/zendesk_conversations_raw"
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                isZendeskRaw
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Zendesk Conversations Raw
            </Link>
            <Link
              href="/events/settings"
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                isSettings
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Configurações
            </Link>
          </nav>
        </div>
      </div>

      <CurrentPage />
    </div>
  );
}
