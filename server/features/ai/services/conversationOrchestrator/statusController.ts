import { storage } from "../../../../storage/index.js";

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
  static async evaluateDemandUnderstood(conversationId: number): Promise<StatusEvaluationResult> {
    const summary = await storage.getConversationSummary(conversationId);

    if (!summary) {
      return {
        canTransition: false,
        reason: "No summary found",
        details: {
          productConfidence: null,
          customerRequestTypeConfidence: null,
          bestArticleMatchScore: 0,
        },
      };
    }

    const productConfidence = summary.productConfidence ?? null;
    const customerRequestTypeConfidence = summary.customerRequestTypeConfidence ?? null;

    const articles = summary.articlesAndObjectiveProblems || [];
    const bestArticleMatchScore = articles.length > 0
      ? Math.max(...articles.map(a => a.matchScore || 0))
      : 0;

    const productMatch = productConfidence === 100;
    const requestTypeMatch = customerRequestTypeConfidence === 100;
    const articleMatch = bestArticleMatchScore >= 90;

    const canTransition = productMatch && requestTypeMatch && articleMatch;

    const reasons: string[] = [];
    if (!productMatch) reasons.push(`productConfidence=${productConfidence} (need 100)`);
    if (!requestTypeMatch) reasons.push(`customerRequestTypeConfidence=${customerRequestTypeConfidence} (need 100)`);
    if (!articleMatch) reasons.push(`bestArticleMatchScore=${bestArticleMatchScore} (need >=90)`);

    const reason = canTransition
      ? `All criteria met: productConfidence=100, customerRequestTypeConfidence=100, bestArticleMatchScore=${bestArticleMatchScore}`
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
