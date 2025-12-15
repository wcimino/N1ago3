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
