import { TabbedLayout } from "../../../shared/components";
import { EventsStandardPage } from "./EventsStandardPage";
import { ZendeskConversationsRawPage } from "../../conversations";
import { EventTypeMappingsPage } from "./EventTypeMappingsPage";

const tabs = [
  {
    path: "/settings/events/events_standard",
    label: "Padronizados",
    component: EventsStandardPage,
  },
  {
    path: "/settings/events/zendesk_conversations_raw",
    label: "Zendesk Raw",
    component: ZendeskConversationsRawPage,
  },
  {
    path: "/settings/events/config",
    label: "Config.",
    component: EventTypeMappingsPage,
  },
];

export function EventsLayout() {
  return (
    <TabbedLayout
      title="Eventos"
      basePath="/settings/events"
      defaultTab="/settings/events/events_standard"
      tabs={tabs}
    />
  );
}
