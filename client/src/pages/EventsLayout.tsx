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
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Eventos</h1>
        <div className="border-b border-gray-200 -mx-3 px-3 sm:mx-0 sm:px-0">
          <nav className="flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide pb-px" aria-label="Tabs">
            <Link
              href="/events/events_standard"
              className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                isEventsStandard
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Padronizados
            </Link>
            <Link
              href="/events/zendesk_conversations_raw"
              className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                isZendeskRaw
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Zendesk Raw
            </Link>
            <Link
              href="/events/settings"
              className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                isSettings
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Config.
            </Link>
          </nav>
        </div>
      </div>

      <CurrentPage />
    </div>
  );
}
