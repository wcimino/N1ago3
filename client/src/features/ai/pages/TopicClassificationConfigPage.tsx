import { OpenaiConfigForm } from "../components";
import { getAgentConfig } from "../config/agentConfigMetadata";

const config = getAgentConfig("topic_classification");

export function TopicClassificationConfigPage() {
  return (
    <OpenaiConfigForm
      configType={config.configType}
      title={config.title}
      description={config.description}
      enabledLabel={config.enabledLabel}
      enabledDescription={config.enabledDescription}
      promptRows={config.promptRows}
      responseFormatRows={config.responseFormatRows}
      recommendedModel={config.recommendedModel}
      showZendeskKnowledgeBaseTool={config.tools.showZendeskKnowledgeBaseTool}
      showObjectiveProblemTool={config.tools.showObjectiveProblemTool}
      showCombinedKnowledgeSearchTool={config.tools.showCombinedKnowledgeSearchTool}
    />
  );
}
