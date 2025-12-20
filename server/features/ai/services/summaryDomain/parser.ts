import type { 
  ParsedSummary, 
  ObjectiveProblemResult, 
  ClientRequestVersions,
  SearchQueries 
} from "./types.js";

function extractJsonFromString(content: string): string | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
}

function normalizeKey<T>(
  obj: Record<string, unknown>,
  ...keys: string[]
): T | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined) {
      return obj[key] as T;
    }
  }
  return undefined;
}

function parseObjectiveProblems(raw: unknown): ObjectiveProblemResult[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }

  const problems = raw
    .filter((p: unknown): p is Record<string, unknown> => 
      p !== null && typeof p === 'object' && 
      typeof (p as Record<string, unknown>).id === 'number' && 
      typeof (p as Record<string, unknown>).name === 'string'
    )
    .map((p) => {
      const rawMatchedTerms = normalizeKey<unknown>(
        p,
        'matchedTerms', 
        'matched_terms', 
        'termosCorrespondentes', 
        'termos_correspondentes'
      );
      
      let matchedTerms: string[] | undefined;
      if (Array.isArray(rawMatchedTerms)) {
        matchedTerms = rawMatchedTerms.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
      } else if (typeof rawMatchedTerms === 'string' && rawMatchedTerms.trim()) {
        matchedTerms = rawMatchedTerms.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
      }

      const matchScore = normalizeKey<number>(p, 'matchScore', 'match_score');

      return {
        id: p.id as number,
        name: p.name as string,
        matchScore: typeof matchScore === 'number' ? matchScore : undefined,
        matchedTerms: matchedTerms && matchedTerms.length > 0 ? matchedTerms : undefined,
      };
    });

  return problems.length > 0 ? problems : undefined;
}

function parseClientRequestVersions(raw: unknown): ClientRequestVersions | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  const versions: ClientRequestVersions = {
    clientRequestStandardVersion: normalizeKey<string>(
      obj,
      'clientRequestStandardVersion',
      'client_request_standard_version'
    ),
    clientRequestQuestionVersion: normalizeKey<string>(
      obj,
      'clientRequestQuestionVersion',
      'client_request_question_version'
    ),
    clientRequestProblemVersion: normalizeKey<string>(
      obj,
      'clientRequestProblemVersion',
      'client_request_problem_version'
    ),
  };

  if (!versions.clientRequestStandardVersion && 
      !versions.clientRequestQuestionVersion && 
      !versions.clientRequestProblemVersion) {
    return undefined;
  }

  return versions;
}

function validateEmotionLevel(value: unknown): number | undefined {
  if (typeof value === 'number' && value >= 1 && value <= 5) {
    return value;
  }
  return undefined;
}

export function parseSummaryJson(summary: string | null | undefined): ParsedSummary | null {
  if (!summary) return null;

  try {
    const parsed = JSON.parse(summary);
    
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    return parsed as ParsedSummary;
  } catch {
    return null;
  }
}

export function parseSummaryResponse(responseContent: string | null | undefined): ParsedSummary | null {
  if (!responseContent) return null;

  try {
    const jsonString = extractJsonFromString(responseContent);
    if (!jsonString) return null;

    const parsed = JSON.parse(jsonString) as Record<string, unknown>;

    const rawProblems = normalizeKey<unknown>(
      parsed,
      'objectiveProblems',
      'problemasObjetivos',
      'problemas_objetivos'
    );

    const rawVersions = normalizeKey<unknown>(
      parsed,
      'clientRequestVersions',
      'client_request_versions'
    );

    const rawEmotionLevel = normalizeKey<unknown>(
      parsed,
      'customerEmotionLevel',
      'customer_emotion_level',
      'nivelEmocaoCliente',
      'nivel_emocao_cliente'
    );

    return {
      clientRequest: normalizeKey<string>(
        parsed,
        'clientRequest',
        'solicitacaoCliente',
        'solicitacao_cliente'
      ),
      clientRequestVersions: parseClientRequestVersions(rawVersions),
      agentActions: normalizeKey<string>(
        parsed,
        'agentActions',
        'acoesAtendente',
        'acoes_atendente'
      ),
      currentStatus: normalizeKey<string>(
        parsed,
        'currentStatus',
        'statusAtual',
        'status_atual'
      ),
      importantInfo: normalizeKey<string>(
        parsed,
        'importantInfo',
        'informacoesImportantes',
        'informacoes_importantes'
      ),
      customerEmotionLevel: validateEmotionLevel(rawEmotionLevel),
      objectiveProblems: parseObjectiveProblems(rawProblems),
      customerRequestType: normalizeKey<string>(parsed, 'customerRequestType'),
      triage: parsed.triage as ParsedSummary['triage'],
      clientRequestVerbatimSearchQuery: normalizeKey<string>(parsed, 'clientRequestVerbatimSearchQuery'),
      clientRequestKeywordSearchQuery: normalizeKey<string>(parsed, 'clientRequestKeywordSearchQuery'),
      clientRequestNormalizedSearchQuery: normalizeKey<string>(parsed, 'clientRequestNormalizedSearchQuery'),
      clientRequestSearchQueryQuality: parsed.clientRequestSearchQueryQuality as ParsedSummary['clientRequestSearchQueryQuality'],
    };
  } catch {
    return null;
  }
}

export function getClientRequest(summary: string | null | undefined): string | null {
  const parsed = parseSummaryJson(summary);
  if (!parsed) {
    return summary?.trim() || null;
  }
  return parsed.clientRequest || parsed.importantInfo || null;
}

export function getCustomerMainComplaint(summary: string | null | undefined): string | null {
  const parsed = parseSummaryJson(summary);
  if (!parsed) {
    return summary?.trim() || null;
  }
  return parsed.triage?.anamnese?.customerMainComplaint || parsed.clientRequest || null;
}

export function getClientRequestVersions(summary: string | null | undefined): ClientRequestVersions | null {
  const parsed = parseSummaryJson(summary);
  if (!parsed?.clientRequestVersions) return null;

  const versions = parsed.clientRequestVersions;
  if (typeof versions !== 'object') return null;

  return {
    clientRequestQuestionVersion: versions.clientRequestQuestionVersion || undefined,
    clientRequestProblemVersion: versions.clientRequestProblemVersion || undefined,
    clientRequestStandardVersion: versions.clientRequestStandardVersion || undefined,
  };
}

export function getSearchQueries(summary: string | null | undefined): SearchQueries | null {
  const parsed = parseSummaryJson(summary);
  if (!parsed) return null;

  const verbatimQuery = parsed.clientRequestVerbatimSearchQuery;
  const keywordQuery = parsed.clientRequestKeywordSearchQuery;
  const normalizedQuery = parsed.clientRequestNormalizedSearchQuery;

  if (!verbatimQuery && !keywordQuery && !normalizedQuery) {
    return null;
  }

  return {
    verbatimQuery: verbatimQuery || undefined,
    keywordQuery: keywordQuery || undefined,
    normalizedQuery: normalizedQuery || undefined,
  };
}

export function getCustomerRequestType(summary: string | null | undefined): string | null {
  const parsed = parseSummaryJson(summary);
  if (!parsed) return null;
  return parsed.customerRequestType || null;
}
