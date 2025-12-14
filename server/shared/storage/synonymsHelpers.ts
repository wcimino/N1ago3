export function normalizeSynonyms(synonyms: string[] | undefined | null): string[] {
  if (!synonyms) return [];
  return synonyms.map(s => s.trim().toLowerCase());
}

export function normalizeSynonymsInData<T extends { synonyms?: string[] | null }>(data: T): T {
  if (data.synonyms) {
    return { ...data, synonyms: normalizeSynonyms(data.synonyms) };
  }
  return data;
}
