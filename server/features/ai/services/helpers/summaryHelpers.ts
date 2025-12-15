export interface ParsedSummary {
  clientRequest?: string;
  importantInfo?: string;
  agentActions?: string;
  currentStatus?: string;
  customerEmotionLevel?: number;
  customerRequestType?: string;
  clientRequestVersions?: {
    clientRequestQuestionVersion?: string;
    clientRequestProblemVersion?: string;
    clientRequestStandardVersion?: string;
  };
  triage?: {
    anamnese?: {
      customerMainComplaint?: string;
    };
  };
  objectiveProblems?: Array<{ id: number; name: string; matchScore?: number }>;
  [key: string]: unknown;
}

export function parseSummaryJson(summary: string | null | undefined): ParsedSummary | null {
  if (!summary) return null;
  
  try {
    const parsed = JSON.parse(summary);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ParsedSummary;
    }
    return null;
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

export function getClientRequestVersions(summary: string | null | undefined): {
  clientRequestQuestionVersion?: string;
  clientRequestProblemVersion?: string;
  clientRequestStandardVersion?: string;
} | null {
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
