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

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

  return {
    score: baseScore,
    reason: bestReason,
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

const PORTUGUESE_STOPWORDS = new Set([
  "a", "o", "e", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos",
  "para", "com", "por", "que", "se", "um", "uma", "uns", "umas", "ao", "aos",
  "pelo", "pela", "pelos", "pelas", "este", "esta", "estes", "estas", "esse",
  "essa", "esses", "essas", "aquele", "aquela", "aqueles", "aquelas", "isto",
  "isso", "aquilo", "meu", "minha", "meus", "minhas", "teu", "tua", "teus",
  "tuas", "seu", "sua", "seus", "suas", "nosso", "nossa", "nossos", "nossas",
  "como", "mais", "mas", "ou", "quando", "muito", "muita", "muitos", "muitas",
  "pouco", "pouca", "poucos", "poucas", "qual", "quais", "quem", "onde", "porque",
  "ja", "ainda", "mesmo", "so", "tambem", "entre", "sobre", "ate", "apos", "desde",
  "sem", "foi", "ser", "esta", "estou", "estar", "tem", "tenho", "ter", "tinha",
  "fui", "foi", "era", "eram", "sou", "somos", "sao", "voce", "eu", "ele", "ela",
  "nos", "eles", "elas", "lhe", "lhes", "me", "te", "nos", "vos", "os", "as"
]);

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeForMatching(text)
    .split(/\s+/)
    .filter(t => t.length >= 2 && !PORTUGUESE_STOPWORDS.has(t));
}

export function extractMatchedTerms(
  queryText: string,
  itemText: string,
  maxTerms: number = 5
): string[] {
  const queryTokens = new Set(tokenize(queryText));
  const itemTokens = new Set(tokenize(itemText));
  
  if (queryTokens.size === 0 || itemTokens.size === 0) {
    return [];
  }
  
  const intersection: string[] = [];
  for (const token of queryTokens) {
    if (itemTokens.has(token)) {
      intersection.push(token);
    }
  }
  
  if (intersection.length === 0) {
    return [];
  }
  
  intersection.sort((a, b) => b.length - a.length);
  
  return intersection.slice(0, maxTerms);
}
