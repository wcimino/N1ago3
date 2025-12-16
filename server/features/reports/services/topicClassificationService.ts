import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import { storage } from "../../../storage/index.js";
import { callOpenAI } from "../../ai/services/openaiApiService.js";

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

export interface QuestionTopicsResult {
  questions: QuestionTopic[];
  themes: ThemeSummary[];
  total: number;
  coverage: CoverageSummary;
}

function getCoverageLevel(score: number | null): "good" | "medium" | "low" | "unknown" {
  if (score === null) return "unknown";
  if (score >= 70) return "good";
  if (score >= 50) return "medium";
  return "low";
}

export type PeriodFilter = "last_hour" | "last_24h" | "all";

function getPeriodClause(period: PeriodFilter): string {
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

async function getQuestionsByProduct(product?: string, subproduct?: string, period: PeriodFilter = "all"): Promise<QuestionTopic[]> {
  const filters: string[] = [];
  if (product) {
    filters.push(`produto = '${product.replace(/'/g, "''")}'`);
  }
  if (subproduct) {
    filters.push(`subproduto = '${subproduct.replace(/'/g, "''")}'`);
  }
  const productFilter = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const periodClause = getPeriodClause(period);

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
      COALESCE(produto, 'Não identificado') as produto,
      subproduto,
      pergunta as question,
      problema,
      COUNT(*) as count,
      ROUND(AVG(top_score), 1) as avg_score
    FROM filtered_data
    GROUP BY produto, subproduto, pergunta, problema
    ORDER BY COUNT(*) DESC
    LIMIT 200
  `));

  return results.rows.map((row: any) => ({
    produto: row.produto || "Não identificado",
    subproduto: row.subproduto || null,
    question: row.question,
    problema: row.problema || null,
    count: parseInt(row.count, 10),
    topScore: row.avg_score ? parseFloat(row.avg_score) : null,
  }));
}

async function classifyQuestionsWithAI(questions: string[]): Promise<Map<string, string>> {
  const config = await storage.getOpenaiApiConfig("topic_classification");
  
  if (!config || !config.enabled) {
    return new Map();
  }

  const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  const promptUser = config.promptTemplate.replace("{{PERGUNTAS}}", questionsText);

  try {
    const result = await callOpenAI({
      requestType: "topic_classification",
      modelName: config.modelName || "gpt-4o-mini",
      promptSystem: config.promptSystem,
      promptUser,
      contextType: "report",
      contextId: "question-topics",
    });

    if (!result.success || !result.responseContent) {
      console.error("Error classifying questions:", result.error);
      return new Map();
    }

    // Remove markdown code fence if present (```json ... ```)
    let jsonContent = result.responseContent.trim();
    if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    
    const parsed = JSON.parse(jsonContent);
    const classificationMap = new Map<string, string>();

    if (parsed.classifications && Array.isArray(parsed.classifications)) {
      for (const item of parsed.classifications) {
        if (item.question && item.theme) {
          classificationMap.set(item.question, item.theme);
        }
      }
    }

    return classificationMap;
  } catch (error) {
    console.error("Error calling OpenAI for topic classification:", error);
    return new Map();
  }
}

export async function getQuestionTopics(product?: string, subproduct?: string, period: PeriodFilter = "all"): Promise<QuestionTopicsResult> {
  const questions = await getQuestionsByProduct(product, subproduct, period);
  
  if (questions.length === 0) {
    return { 
      questions: [], 
      themes: [], 
      total: 0,
      coverage: { total: 0, goodCoverage: 0, mediumCoverage: 0, lowCoverage: 0, noCoverage: 0 }
    };
  }

  const uniqueQuestions = [...new Set(questions.map(q => q.question))];
  const classificationMap = await classifyQuestionsWithAI(uniqueQuestions);

  const questionsWithThemes = questions.map(q => ({
    ...q,
    theme: classificationMap.get(q.question) || "Outros",
  }));

  const themeMap = new Map<string, ThemeSummary>();
  let total = 0;
  let totalQuestions = questionsWithThemes.length;
  let goodCoverage = 0;
  let mediumCoverage = 0;
  let lowCoverage = 0;
  let noCoverage = 0;

  for (const q of questionsWithThemes) {
    total += q.count;
    const theme = q.theme || "Outros";
    
    const coverageLevel = getCoverageLevel(q.topScore);
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
      themeSummary.coverage = getCoverageLevel(themeSummary.avgScore);
    }
  }

  const themes = Array.from(themeMap.values())
    .sort((a, b) => b.count - a.count)
    .map(t => ({
      ...t,
      questions: t.questions.sort((a, b) => b.count - a.count),
    }));

  return { 
    questions: questionsWithThemes, 
    themes, 
    total,
    coverage: { total: totalQuestions, goodCoverage, mediumCoverage, lowCoverage, noCoverage }
  };
}

export async function getAvailableProducts(): Promise<string[]> {
  const results = await db.execute(sql.raw(`
    SELECT DISTINCT produto
    FROM (
      SELECT DISTINCT ON (context_id)
        context_id,
        substring(response_raw->'choices'->0->'message'->>'content' from '"product":\\s*"([^"]+)"') as produto
      FROM openai_api_logs 
      WHERE request_type = 'classification'
        AND created_at >= NOW() - INTERVAL '30 days'
      ORDER BY context_id, created_at DESC
    ) lc
    WHERE produto IS NOT NULL
    ORDER BY produto
  `));

  return results.rows.map((row: any) => row.produto);
}

export async function getAvailableSubproducts(product?: string): Promise<string[]> {
  let productFilter = "";
  if (product) {
    productFilter = `AND produto = '${product.replace(/'/g, "''")}'`;
  }

  const results = await db.execute(sql.raw(`
    SELECT DISTINCT subproduto
    FROM (
      SELECT DISTINCT ON (context_id)
        context_id,
        substring(response_raw->'choices'->0->'message'->>'content' from '"product":\\s*"([^"]+)"') as produto,
        substring(response_raw->'choices'->0->'message'->>'content' from '"subproduct":\\s*"([^"]+)"') as subproduto
      FROM openai_api_logs 
      WHERE request_type = 'classification'
        AND created_at >= NOW() - INTERVAL '30 days'
      ORDER BY context_id, created_at DESC
    ) lc
    WHERE subproduto IS NOT NULL
    ${productFilter}
    ORDER BY subproduto
  `));

  return results.rows.map((row: any) => row.subproduto);
}
