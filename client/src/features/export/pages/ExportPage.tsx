import { TabbedLayout } from "../../../shared/components/TabbedLayout";
import { ExportSummariesPage } from "./ExportSummariesPage";

const tabs = [
  {
    path: "/export/summaries",
    label: "Resumos",
    component: ExportSummariesPage,
  },
];

export function ExportPage() {
  return (
    <TabbedLayout
      title="Exportações"
      basePath="/export"
      defaultTab="/export/summaries"
      tabs={tabs}
    />
  );
}
