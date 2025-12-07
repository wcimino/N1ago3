import { TabbedLayout } from "../shared/components";
import { OpenaiSummaryConfigPage } from "./OpenaiSummaryConfigPage";
import { ClassificationConfigPage } from "./ClassificationConfigPage";
import { ResponseConfigPage } from "./ResponseConfigPage";

const tabs = [
  {
    path: "/ai/settings/summary",
    label: "Resumo",
    component: OpenaiSummaryConfigPage,
  },
  {
    path: "/ai/settings/classification",
    label: "Classificação",
    component: ClassificationConfigPage,
  },
  {
    path: "/ai/settings/response",
    label: "Resposta",
    component: ResponseConfigPage,
  },
];

export function AIPage() {
  return (
    <TabbedLayout
      title="Configuração de IA"
      basePath="/ai"
      defaultTab="/ai/settings/summary"
      tabs={tabs}
    />
  );
}
