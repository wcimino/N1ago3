import { TabbedLayout } from "../../../shared/components/TabbedLayout";
import { EventsStandardPage } from "./EventsStandardPage";
import { ZendeskConversationsRawPage } from "./ZendeskConversationsRawPage";
import { EventTypeMappingsPage } from "./EventTypeMappingsPage";

const tabs = [
  {
    path: "/events/events_standard",
    label: "Padronizados",
    component: EventsStandardPage,
  },
  {
    path: "/events/zendesk_conversations_raw",
    label: "Zendesk Raw",
    component: ZendeskConversationsRawPage,
  },
  {
    path: "/events/settings",
    label: "Config.",
    component: EventTypeMappingsPage,
  },
];

export function EventsLayout() {
  return (
    <TabbedLayout
      title="Eventos"
      basePath="/events"
      defaultTab="/events/events_standard"
      tabs={tabs}
    />
  );
}
