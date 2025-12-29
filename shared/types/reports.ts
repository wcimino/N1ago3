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
  coverage: CoverageLevel;
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

export type PeriodFilter = "last_hour" | "last_24h" | "all";
export type CoverageLevel = "good" | "medium" | "low" | "unknown";
export type CoverageFilter = "all" | "good" | "medium" | "low";
