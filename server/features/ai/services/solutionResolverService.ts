import { db } from "../../../db.js";
import { knowledgeBaseSolutions, knowledgeBaseRootCauseHasKnowledgeBaseSolutions } from "../../../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { caseDemandStorage } from "../storage/caseDemandStorage.js";
import { caseSolutionStorage } from "../storage/caseSolutionStorage.js";
import type { CaseSolution } from "../../../../shared/schema.js";

export interface ResolvedSolution {
  solutionId: number;
  solutionName: string;
  solutionType: "specific" | "fallback";
  rootCauseId?: number;
}

export class SolutionResolverService {
  static async resolveSolutionForConversation(
    conversationId: number,
    rootCauseId?: number
  ): Promise<ResolvedSolution | null> {
    console.log(`[SolutionResolver] Resolving solution for conversation ${conversationId}, rootCauseId: ${rootCauseId}`);

    const caseDemand = await caseDemandStorage.getFirstByConversationId(conversationId);
    const topMatch = caseDemand?.articlesAndObjectiveProblemsTopMatch as {
      source: "problem";
      id: number;
      name: string | null;
      description: string;
      resolution?: string;
    } | null;

    console.log(`[SolutionResolver] TopMatch: ${topMatch ? `${topMatch.source}:${topMatch.id}` : "none"}`);

    if (rootCauseId) {
      const specificSolution = await this.getSolutionByRootCause(rootCauseId);
      if (specificSolution) {
        console.log(`[SolutionResolver] Found specific solution via rootCause: ${specificSolution.name}`);
        return {
          solutionId: specificSolution.id,
          solutionName: specificSolution.name,
          solutionType: "specific",
          rootCauseId,
        };
      }
    }

    if (topMatch?.source === "problem") {
      console.log(`[SolutionResolver] TopMatch is problem, but no rootCauseId or specific solution found - using fallback`);
    }

    const fallbackSolution = await this.getFallbackSolution();
    if (fallbackSolution) {
      console.log(`[SolutionResolver] Using fallback solution`);
      return {
        solutionId: fallbackSolution.id,
        solutionName: fallbackSolution.name,
        solutionType: "fallback",
      };
    }

    console.log(`[SolutionResolver] No solution found`);
    return null;
  }

  private static async getSolutionByRootCause(rootCauseId: number): Promise<{ id: number; name: string } | null> {
    const [result] = await db.select({
      id: knowledgeBaseSolutions.id,
      name: knowledgeBaseSolutions.name,
    })
      .from(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
      .innerJoin(
        knowledgeBaseSolutions,
        eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.solutionId, knowledgeBaseSolutions.id)
      )
      .where(and(
        eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.rootCauseId, rootCauseId),
        eq(knowledgeBaseSolutions.isActive, true)
      ))
      .limit(1);

    return result || null;
  }

  private static async getFallbackSolution(): Promise<{ id: number; name: string } | null> {
    const [result] = await db.select({
      id: knowledgeBaseSolutions.id,
      name: knowledgeBaseSolutions.name,
    })
      .from(knowledgeBaseSolutions)
      .where(and(
        eq(knowledgeBaseSolutions.isFallback, true),
        eq(knowledgeBaseSolutions.isActive, true)
      ))
      .limit(1);

    return result || null;
  }

  static async createCaseSolutionWithActions(
    conversationId: number,
    resolvedSolution: ResolvedSolution,
    providedInputs?: Record<string, unknown>
  ): Promise<CaseSolution> {
    console.log(`[SolutionResolver] Creating case_solution for conversation ${conversationId}, solution: ${resolvedSolution.solutionName}`);

    const inputs: Record<string, unknown> = {
      ...providedInputs,
    };

    const caseSolution = await caseSolutionStorage.createWithActions({
      conversationId,
      solutionId: resolvedSolution.solutionId,
      rootCauseId: resolvedSolution.rootCauseId,
      status: "pending_info",
      providedInputs: inputs,
    });

    console.log(`[SolutionResolver] Created case_solution id=${caseSolution.id} with ${caseSolution.actions?.length || 0} actions`);

    return caseSolution;
  }
}
