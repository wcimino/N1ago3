import { OpenaiConfigForm } from "../components";
import { getAgentConfig } from "../config/agentConfigMetadata";

const config = getAgentConfig("articles_and_solutions");

export function ArticlesAndSolutionsConfigPage() {
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
      showKnowledgeBaseTool={config.tools.showKnowledgeBaseTool}
      showProductCatalogTool={config.tools.showProductCatalogTool}
      showZendeskKnowledgeBaseTool={config.tools.showZendeskKnowledgeBaseTool}
      showSubjectIntentTool={config.tools.showSubjectIntentTool}
      showObjectiveProblemTool={config.tools.showObjectiveProblemTool}
      showCombinedKnowledgeSearchTool={config.tools.showCombinedKnowledgeSearchTool}
    />
  );
}
