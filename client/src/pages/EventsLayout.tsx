import { useEffect } from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import { EventsStandardPage } from "./EventsStandardPage";
import { ZendeskConversationsRawPage } from "./ZendeskConversationsRawPage";
import { EventTypeMappingsPage } from "./EventTypeMappingsPage";

export function EventsLayout() {
  const [location, setLocation] = useLocation();
  
  const isEventsStandard = location === "/events" || location === "/events/" || location === "/events/events_standard";
  const isZendeskRaw = location === "/events/zendesk_conversations_raw";
  const isSettings = location === "/events/settings";

  useEffect(() => {
    if (location === "/events" || location === "/events/") {
      setLocation("/events/events_standard", { replace: true });
    }
  }, [location, setLocation]);

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

      <Switch>
        <Route path="/events/events_standard" component={EventsStandardPage} />
        <Route path="/events/zendesk_conversations_raw" component={ZendeskConversationsRawPage} />
        <Route path="/events/settings" component={EventTypeMappingsPage} />
        <Route path="/events" component={EventsStandardPage} />
      </Switch>
    </div>
  );
}
