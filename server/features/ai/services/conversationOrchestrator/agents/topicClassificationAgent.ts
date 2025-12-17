import { db } from "../../../../../db.js";
import { sql } from "drizzle-orm";
import { storage } from "../../../../../storage/index.js";
import { runAgent } from "../../agentFramework.js";
import type { AgentResult } from "../types.js";

const CONFIG_KEY = "topic_classification";
const BATCH_SIZE = 25;

export interface QuestionTopic {
  produto: string;
  subproduto: string | null;
  question: string;
  problema: string | null;
  count: number;
  topScore: number | null;
  theme?: string;
}

export interface ThemeSummary {
  theme: string;
  count: number;
  avgScore: number | null;
  coverage: "good" | "medium" | "low" | "unknown";
  questions: Array<{
    question: string;
    count: number;
    subproduto: string | null;
    topScore: number | null;
  }>;
}

export interface CoverageSummary {
  total: number;
  goodCoverage: number;
  mediumCoverage: number;
  lowCoverage: number;
  noCoverage: number;
}

export interface TopicClassificationAgentResult extends AgentResult {
  questions?: QuestionTopic[];
  themes?: ThemeSummary[];
  total?: number;
  coverage?: CoverageSummary;
}

export type PeriodFilter = "last_hour" | "last_24h" | "all";

interface SubjectProductMap {
  [subject: string]: string;
}

export class TopicClassificationAgent {
  static async process(
    product?: string, 
    subproduct?: string, 
    period: PeriodFilter = "all"
  ): Promise<TopicClassificationAgentResult> {
    try {
      const questions = await this.getQuestionsByProduct(product, subproduct, period);
      
      if (questions.length === 0) {
        return { 
          success: true,
          questions: [], 
          themes: [], 
          total: 0,
          coverage: { total: 0, goodCoverage: 0, mediumCoverage: 0, lowCoverage: 0, noCoverage: 0 }
        };
      }

      const uniqueQuestions = [...new Set(questions.map(q => q.question.trim()))];
      const classificationMap = await this.classifyQuestionsWithAI(uniqueQuestions, product);

      const questionsWithThemes = questions.map(q => ({
        ...q,
        theme: classificationMap.get(q.question.trim()) || "Outros",
      }));

      const { themes, coverage, total } = this.buildThemeSummary(questionsWithThemes);

      console.log(`[TopicClassificationAgent] Processed ${questions.length} questions into ${themes.length} themes`);

      return { 
        success: true,
        questions: questionsWithThemes, 
        themes, 
        total,
        coverage
      };
    } catch (error: any) {
      console.error(`[TopicClassificationAgent] Error processing:`, error);
      return {
        success: false,
        error: error.message || "Failed to classify topics",
      };
    }
  }

  private static async getQuestionsByProduct(
    product?: string, 
    subproduct?: string, 
    period: PeriodFilter = "all"
  ): Promise<QuestionTopic[]> {
    const filters: string[] = [];
    if (product) {
      filters.push(`produto = '${product.replace(/'/g, "''")}'`);
    }
    if (subproduct) {
      filters.push(`subproduto = '${subproduct.replace(/'/g, "''")}'`);
    }
    const productFilter = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const periodClause = this.getPeriodClause(period);

    const results = await db.execute(sql.raw(`
      WITH latest_summary AS (
        SELECT DISTINCT ON (context_id)
          context_id,
          substring(response_raw->'choices'->0->'message'->>'content' from '"clientRequestQuestionVersion":\\s*"([^"]+)"') as pergunta,
          substring(response_raw->'choices'->0->'message'->>'content' from '"clientRequestProblemVersion":\\s*"([^"]+)"') as problema,
          created_at
        FROM openai_api_logs 
        WHERE request_type = 'summary'
          ${periodClause}
        ORDER BY context_id, created_at DESC
      ),
      latest_classification AS (
        SELECT DISTINCT ON (context_id)
          context_id,
          substring(response_raw->'choices'->0->'message'->>'content' from '"product":\\s*"([^"]+)"') as produto,
          substring(response_raw->'choices'->0->'message'->>'content' from '"subproduct":\\s*"([^"]+)"') as subproduto
        FROM openai_api_logs 
        WHERE request_type = 'classification'
        ORDER BY context_id, created_at DESC
      ),
      latest_articles AS (
        SELECT DISTINCT ON (context_id)
          context_id,
          (regexp_matches(
            response_raw->'choices'->0->'message'->>'content',
            '"matchScore":\\s*(\\d+\\.?\\d*)'
          ))[1]::numeric as top_score
        FROM openai_api_logs 
        WHERE request_type = 'articles_and_solutions'
          AND response_raw->'choices'->0->'message'->>'content' NOT LIKE '%\`%'
        ORDER BY context_id, created_at DESC
      ),
      combined_data AS (
        SELECT 
          s.context_id,
          s.pergunta,
          s.problema,
          c.produto,
          c.subproduto,
          a.top_score
        FROM latest_summary s
        LEFT JOIN latest_classification c ON c.context_id = s.context_id
        LEFT JOIN latest_articles a ON a.context_id = s.context_id
        WHERE s.pergunta IS NOT NULL
      ),
      filtered_data AS (
        SELECT * FROM combined_data
        ${productFilter}
      )
      SELECT 
        pergunta as question,
        COUNT(*) as count,
        ROUND(AVG(top_score), 1) as avg_score
      FROM filtered_data
      GROUP BY pergunta
      ORDER BY COUNT(*) DESC
      LIMIT 100
    `));

    return results.rows.map((row: any) => ({
      produto: product || "Não identificado",
      subproduto: subproduct || null,
      question: row.question,
      problema: null,
      count: parseInt(row.count, 10),
      topScore: row.avg_score ? parseFloat(row.avg_score) : null,
    }));
  }

  private static getPeriodClause(period: PeriodFilter): string {
    switch (period) {
      case "last_hour":
        return "AND created_at >= NOW() - INTERVAL '1 hour'";
      case "last_24h":
        return "AND created_at >= NOW() - INTERVAL '24 hours'";
      case "all":
      default:
        return "";
    }
  }

  private static async classifyQuestionsWithAI(
    questions: string[], 
    productFilter?: string
  ): Promise<Map<string, string>> {
    const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
    
    if (!config || !config.enabled) {
      return new Map();
    }

    const subjectsMap = await this.getSubjectsByProduct(productFilter);
    const subjectsJson = JSON.stringify(subjectsMap, null, 2);
    
    console.log(`[TopicClassificationAgent] Using ${Object.keys(subjectsMap).length} subjects for product: ${productFilter || 'all'}, total questions: ${questions.length}`);
    
    const classificationMap = new Map<string, string>();
    
    const batches: string[][] = [];
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      batches.push(questions.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[TopicClassificationAgent] Processing ${batches.length} batches of up to ${BATCH_SIZE} questions each`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[TopicClassificationAgent] Processing batch ${i + 1}/${batches.length} (${batch.length} questions)`);
      
      const batchResult = await this.classifyBatch(batch, config, subjectsJson);
      
      for (const [question, theme] of batchResult) {
        classificationMap.set(question, theme);
      }
      
      console.log(`[TopicClassificationAgent] Batch ${i + 1} classified ${batchResult.size} questions`);
    }

    console.log(`[TopicClassificationAgent] Total classified: ${classificationMap.size}/${questions.length} questions`);
    return classificationMap;
  }

  private static async classifyBatch(
    questions: string[], 
    config: any, 
    subjectsJson: string
  ): Promise<Map<string, string>> {
    const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");

    console.log(`[TopicClassificationAgent] classifyBatch starting with ${questions.length} questions`);
    console.log(`[TopicClassificationAgent] customVariables: PERGUNTAS length=${questionsText.length}, PRODUTO_SUBPRODUTO_ASSUNTO length=${subjectsJson.length}`);

    try {
      const result = await runAgent(CONFIG_KEY, {
        conversationId: 0,
        externalConversationId: "report-question-topics",
        lastEventId: 0,
        summary: null,
        messages: [],
        customVariables: {
          PERGUNTAS: questionsText,
          PRODUTO_SUBPRODUTO_ASSUNTO: subjectsJson,
        },
      });

      console.log(`[TopicClassificationAgent] runAgent result: success=${result.success}, logId=${result.logId}, hasContent=${!!result.responseContent}`);

      if (!result.success || !result.responseContent) {
        console.error("[TopicClassificationAgent] Error classifying batch:", result.error);
        console.error("[TopicClassificationAgent] Full result:", JSON.stringify(result, null, 2));
        return new Map();
      }

      let jsonContent = result.responseContent.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseError) {
        let fixedJson = jsonContent;
        if (!fixedJson.endsWith("}")) {
          const lastCompleteObject = fixedJson.lastIndexOf("},");
          if (lastCompleteObject > 0) {
            fixedJson = fixedJson.substring(0, lastCompleteObject + 1) + "]}";
          }
        }
        try {
          parsed = JSON.parse(fixedJson);
          console.log(`[TopicClassificationAgent] Fixed truncated JSON, recovered partial data`);
        } catch {
          console.error("[TopicClassificationAgent] Could not parse or fix JSON response");
          return new Map();
        }
      }
      
      const batchMap = new Map<string, string>();
      if (parsed.classifications && Array.isArray(parsed.classifications)) {
        console.log(`[TopicClassificationAgent] Parsed ${parsed.classifications.length} classifications from AI response`);
        for (const item of parsed.classifications) {
          if (item.question && item.theme) {
            batchMap.set(item.question.trim(), item.theme);
          }
        }
        const themeCounts = new Map<string, number>();
        for (const theme of batchMap.values()) {
          themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
        }
        console.log(`[TopicClassificationAgent] Themes distribution:`, Object.fromEntries(themeCounts));
      } else {
        console.error(`[TopicClassificationAgent] No classifications array in parsed response:`, JSON.stringify(parsed).substring(0, 500));
      }
      return batchMap;
    } catch (error) {
      console.error("[TopicClassificationAgent] Error running agent:", error);
      return new Map();
    }
  }

  private static async getSubjectsByProduct(productFilter?: string): Promise<SubjectProductMap> {
    const productClause = productFilter 
      ? `WHERE pc.produto = '${productFilter.replace(/'/g, "''")}'`
      : "";
      
    const results = await db.execute(sql.raw(`
      SELECT 
        COALESCE(pc.produto, 'Geral') as produto,
        pc.subproduto,
        ks.name as subject
      FROM knowledge_subjects ks
      LEFT JOIN products_catalog pc ON ks.product_catalog_id = pc.id
      ${productClause}
      ORDER BY ks.name
    `));

    const subjectMap: SubjectProductMap = {};
    
    for (const row of results.rows as any[]) {
      if (row.subject && !subjectMap[row.subject]) {
        const productPath = row.subproduto 
          ? `${row.produto} > ${row.subproduto}` 
          : row.produto;
        subjectMap[row.subject] = productPath;
      }
    }
    
    return subjectMap;
  }

  private static getCoverageLevel(score: number | null): "good" | "medium" | "low" | "unknown" {
    if (score === null) return "unknown";
    if (score >= 70) return "good";
    if (score >= 50) return "medium";
    return "low";
  }

  private static buildThemeSummary(questionsWithThemes: QuestionTopic[]): {
    themes: ThemeSummary[];
    coverage: CoverageSummary;
    total: number;
  } {
    const themeMap = new Map<string, ThemeSummary>();
    let total = 0;
    const totalQuestions = questionsWithThemes.length;
    let goodCoverage = 0;
    let mediumCoverage = 0;
    let lowCoverage = 0;
    let noCoverage = 0;

    for (const q of questionsWithThemes) {
      total += q.count;
      const theme = q.theme || "Outros";
      
      const coverageLevel = this.getCoverageLevel(q.topScore);
      if (coverageLevel === "good") goodCoverage++;
      else if (coverageLevel === "medium") mediumCoverage++;
      else if (coverageLevel === "low") lowCoverage++;
      else noCoverage++;
      
      if (!themeMap.has(theme)) {
        themeMap.set(theme, { 
          theme, 
          count: 0, 
          avgScore: null,
          coverage: "unknown",
          questions: [] 
        });
      }
      
      const themeSummary = themeMap.get(theme)!;
      themeSummary.count += q.count;
      themeSummary.questions.push({
        question: q.question,
        count: q.count,
        subproduto: q.subproduto,
        topScore: q.topScore,
      });
    }

    for (const [, themeSummary] of themeMap) {
      const scoresWithValue = themeSummary.questions
        .filter(q => q.topScore !== null)
        .map(q => ({ score: q.topScore!, count: q.count }));
      
      if (scoresWithValue.length > 0) {
        const totalWeighted = scoresWithValue.reduce((sum, q) => sum + q.score * q.count, 0);
        const totalCount = scoresWithValue.reduce((sum, q) => sum + q.count, 0);
        themeSummary.avgScore = Math.round((totalWeighted / totalCount) * 10) / 10;
        themeSummary.coverage = this.getCoverageLevel(themeSummary.avgScore);
      }
    }

    const themes = Array.from(themeMap.values())
      .sort((a, b) => b.count - a.count)
      .map(t => ({
        ...t,
        questions: t.questions.sort((a, b) => b.count - a.count),
      }));

    return { 
      themes, 
      total,
      coverage: { total: totalQuestions, goodCoverage, mediumCoverage, lowCoverage, noCoverage }
    };
  }

  static async getAvailableProducts(): Promise<string[]> {
    const results = await db.execute(sql.raw(`
      SELECT DISTINCT produto
      FROM products_catalog
      WHERE produto IS NOT NULL
      ORDER BY produto
    `));

    return results.rows.map((row: any) => row.produto);
  }

  static async getAvailableSubproducts(product?: string): Promise<string[]> {
    let productFilter = "";
    if (product) {
      productFilter = `WHERE produto = '${product.replace(/'/g, "''")}'`;
    }

    const results = await db.execute(sql.raw(`
      SELECT DISTINCT subproduto
      FROM products_catalog
      ${productFilter}
      ${productFilter ? "AND" : "WHERE"} subproduto IS NOT NULL
      ORDER BY subproduto
    `));

    return results.rows.map((row: any) => row.subproduto);
  }
}
