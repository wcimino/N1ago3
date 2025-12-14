export interface MatchField {
  name: string;
  value: string;
  weight: 'exact_name' | 'exact_secondary' | 'contains_name' | 'contains_secondary' | 'contains_tertiary' | 'contains_low';
}

export interface MatchScoreResult {
  score: number;
  reason: string;
  matchedFields: string[];
  termsFound: number;
}

const WEIGHT_SCORES: Record<MatchField['weight'], number> = {
  exact_name: 100,
  exact_secondary: 90,
  contains_name: 80,
  contains_secondary: 70,
  contains_tertiary: 60,
  contains_low: 40,
};

const BONUS_EXTRA_TERM = 5;
const BONUS_FREQUENCY = 3;
const BONUS_MULTI_FIELD = 10;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function countOccurrences(text: string, term: string): number {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return 0;
  
  let count = 0;
  let pos = 0;
  while ((pos = normalizedText.indexOf(normalizedTerm, pos)) !== -1) {
    count++;
    pos += normalizedTerm.length;
  }
  return count;
}

export function calculateMatchScore(
  fields: MatchField[],
  searchTerms: string[]
): MatchScoreResult {
  if (searchTerms.length === 0) {
    return { score: 0, reason: "Sem termos de busca", matchedFields: [], termsFound: 0 };
  }

  let baseScore = 0;
  let bestReason = "";
  const matchedFieldNames = new Set<string>();
  const termsMatched = new Set<string>();
  let frequencyBonus = 0;

  for (const term of searchTerms) {
    const normalizedTerm = normalizeText(term);
    if (normalizedTerm.length < 2) continue;

    for (const field of fields) {
      if (!field.value) continue;
      
      const normalizedValue = normalizeText(field.value);
      const isExactMatch = normalizedValue === normalizedTerm;
      const containsMatch = normalizedValue.includes(normalizedTerm);

      if (!isExactMatch && !containsMatch) continue;

      termsMatched.add(term);
      matchedFieldNames.add(field.name);

      const occurrences = countOccurrences(field.value, term);
      if (occurrences > 1) {
        frequencyBonus += BONUS_FREQUENCY * (occurrences - 1);
      }

      let fieldScore = 0;
      let reason = "";

      if (isExactMatch) {
        if (field.weight === 'exact_name' || field.weight === 'contains_name') {
          fieldScore = WEIGHT_SCORES.exact_name;
          reason = `Nome exato: '${field.value}'`;
        } else if (field.weight === 'exact_secondary' || field.weight === 'contains_secondary') {
          fieldScore = WEIGHT_SCORES.exact_secondary;
          reason = `${field.name} exato: '${term}'`;
        } else {
          fieldScore = WEIGHT_SCORES.contains_secondary;
          reason = `${field.name} exato: '${term}'`;
        }
      } else if (containsMatch) {
        fieldScore = WEIGHT_SCORES[field.weight];
        reason = `${field.name} contém: '${term}'`;
      }

      if (fieldScore > baseScore) {
        baseScore = fieldScore;
        bestReason = reason;
      }
    }
  }

  if (baseScore === 0) {
    return { score: 0, reason: "Sem match", matchedFields: [], termsFound: 0 };
  }

  const extraTermsBonus = Math.max(0, termsMatched.size - 1) * BONUS_EXTRA_TERM;

  const multiFieldBonus = matchedFieldNames.size >= 2 ? BONUS_MULTI_FIELD : 0;

  const totalScore = Math.min(baseScore + extraTermsBonus + frequencyBonus + multiFieldBonus, 100);

  const bonusParts: string[] = [];
  if (extraTermsBonus > 0) bonusParts.push(`+${extraTermsBonus} (${termsMatched.size} termos)`);
  if (frequencyBonus > 0) bonusParts.push(`+${frequencyBonus} (frequência)`);
  if (multiFieldBonus > 0) bonusParts.push(`+${multiFieldBonus} (multi-campo)`);

  const finalReason = bonusParts.length > 0 
    ? `${bestReason} ${bonusParts.join(' ')}`
    : bestReason;

  return {
    score: Math.round(totalScore * 100) / 100,
    reason: finalReason,
    matchedFields: Array.from(matchedFieldNames),
    termsFound: termsMatched.size,
  };
}

export function parseSearchTerms(keywords: string): string[] {
  return keywords
    .toLowerCase()
    .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}
