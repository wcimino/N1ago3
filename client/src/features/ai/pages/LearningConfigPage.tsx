import { OpenaiConfigForm } from "../components";
import { getAgentConfig } from "../config/agentConfigMetadata";

const config = getAgentConfig("learning");

export function LearningConfigPage() {
  return (
    <OpenaiConfigForm
      configType={config.configType}
      title={config.title}
      description={config.description}
      enabledLabel={config.enabledLabel}
      enabledDescription={config.enabledDescription}
      eventTriggerLabel={config.eventTriggerLabel}
      eventTriggerDescription={config.eventTriggerDescription}
      authorFilterDescription={config.authorFilterDescription}
      promptRows={config.promptRows}
      responseFormatRows={config.responseFormatRows}
      recommendedModel={config.recommendedModel}
      showKnowledgeBaseTool={config.tools.showKnowledgeBaseTool}
      showProductCatalogTool={config.tools.showProductCatalogTool}
      showZendeskKnowledgeBaseTool={config.tools.showZendeskKnowledgeBaseTool}
      showSubjectIntentTool={config.tools.showSubjectIntentTool}
      showObjectiveProblemTool={config.tools.showObjectiveProblemTool}
    />
  );
}
