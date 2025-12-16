import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import { storage } from "../../../storage/index.js";
import { callOpenAI } from "../../ai/services/openaiApiService.js";

export interface QuestionTopic {
  produto: string;
  subproduto: string | null;
  question: string;
  count: number;
  theme?: string;
}

export interface ThemeSummary {
  theme: string;
  count: number;
  questions: Array<{
    question: string;
    count: number;
    subproduto: string | null;
  }>;
}

export interface QuestionTopicsResult {
  questions: QuestionTopic[];
  themes: ThemeSummary[];
  total: number;
}

async function getQuestionsByProduct(product?: string): Promise<QuestionTopic[]> {
  let whereClause = `WHERE cs.client_request_versions->>'clientRequestQuestionVersion' IS NOT NULL`;
  if (product) {
    whereClause += ` AND pc.produto = '${product.replace(/'/g, "''")}'`;
  }

  const results = await db.execute(sql.raw(`
    SELECT 
      pc.produto AS produto,
      pc.subproduto AS subproduto,
      cs.client_request_versions->>'clientRequestQuestionVersion' AS question,
      COUNT(*) AS count
    FROM openai_api_logs oal
    JOIN conversations c ON c.external_conversation_id = oal.context_id
    JOIN conversations_summary cs ON cs.conversation_id = c.id
    JOIN products_catalog pc ON pc.id = cs.product_id
    ${whereClause}
    GROUP BY 
      pc.produto,
      pc.subproduto,
      cs.client_request_versions->>'clientRequestQuestionVersion'
    ORDER BY COUNT(*) DESC
    LIMIT 100
  `));

  return results.rows.map((row: any) => ({
    produto: row.produto || "Não identificado",
    subproduto: row.subproduto || null,
    question: row.question,
    count: parseInt(row.count, 10),
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

    const parsed = JSON.parse(result.responseContent);
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

export async function getQuestionTopics(product?: string): Promise<QuestionTopicsResult> {
  const questions = await getQuestionsByProduct(product);
  
  if (questions.length === 0) {
    return { questions: [], themes: [], total: 0 };
  }

  const uniqueQuestions = [...new Set(questions.map(q => q.question))];
  const classificationMap = await classifyQuestionsWithAI(uniqueQuestions);

  const questionsWithThemes = questions.map(q => ({
    ...q,
    theme: classificationMap.get(q.question) || "Outros",
  }));

  const themeMap = new Map<string, ThemeSummary>();
  let total = 0;

  for (const q of questionsWithThemes) {
    total += q.count;
    const theme = q.theme || "Outros";
    
    if (!themeMap.has(theme)) {
      themeMap.set(theme, { theme, count: 0, questions: [] });
    }
    
    const themeSummary = themeMap.get(theme)!;
    themeSummary.count += q.count;
    themeSummary.questions.push({
      question: q.question,
      count: q.count,
      subproduto: q.subproduto,
    });
  }

  const themes = Array.from(themeMap.values())
    .sort((a, b) => b.count - a.count)
    .map(t => ({
      ...t,
      questions: t.questions.sort((a, b) => b.count - a.count),
    }));

  return { questions: questionsWithThemes, themes, total };
}

export async function getAvailableProducts(): Promise<string[]> {
  const results = await db.execute(sql.raw(`
    SELECT DISTINCT pc.produto
    FROM conversations_summary cs
    JOIN products_catalog pc ON pc.id = cs.product_id
    WHERE cs.client_request_versions->>'clientRequestQuestionVersion' IS NOT NULL
    ORDER BY pc.produto
  `));

  return results.rows.map((row: any) => row.produto);
}
