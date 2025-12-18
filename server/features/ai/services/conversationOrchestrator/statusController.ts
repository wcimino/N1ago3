import { caseDemandStorage } from "../../storage/caseDemandStorage.js";
import type { OrchestratorContext } from "./types.js";

export interface StatusEvaluationResult {
  canTransition: boolean;
  reason: string;
  details: {
    productConfidence: number | null;
    customerRequestTypeConfidence: number | null;
    bestArticleMatchScore: number;
  };
}

export class StatusController {
  static async evaluateDemandUnderstood(conversationId: number, context?: OrchestratorContext): Promise<StatusEvaluationResult> {
    const caseDemandData = await caseDemandStorage.getFirstByConversationId(conversationId);

    const productConfidence = context?.classification?.productConfidence ?? null;
    const customerRequestTypeConfidence = context?.classification?.customerRequestTypeConfidence ?? null;

    const articles = caseDemandData?.articlesAndObjectiveProblems || [];
    const bestArticleMatchScore = articles.length > 0
      ? Math.max(...articles.map(a => a.matchScore || 0))
      : 0;

    const productMatch = productConfidence !== null && productConfidence >= 90;
    const requestTypeMatch = customerRequestTypeConfidence !== null && customerRequestTypeConfidence >= 90;
    const articleMatch = bestArticleMatchScore >= 80;

    const canTransition = productMatch && requestTypeMatch && articleMatch;

    const reasons: string[] = [];
    if (!productMatch) reasons.push(`productConfidence=${productConfidence} (need >=90)`);
    if (!requestTypeMatch) reasons.push(`customerRequestTypeConfidence=${customerRequestTypeConfidence} (need >=90)`);
    if (!articleMatch) reasons.push(`bestArticleMatchScore=${bestArticleMatchScore} (need >=80)`);

    const reason = canTransition
      ? `All criteria met: productConfidence>=${productConfidence}, customerRequestTypeConfidence>=${customerRequestTypeConfidence}, bestArticleMatchScore=${bestArticleMatchScore}`
      : `Criteria not met: ${reasons.join(", ")}`;

    console.log(`[StatusController] Evaluating conversation ${conversationId}: ${reason}`);

    return {
      canTransition,
      reason,
      details: {
        productConfidence,
        customerRequestTypeConfidence,
        bestArticleMatchScore,
      },
    };
  }
}
