export const REQUEST_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'response': { label: 'Sugestão', bg: 'bg-blue-500', text: 'text-blue-600' },
  'summary': { label: 'Resumo', bg: 'bg-emerald-500', text: 'text-emerald-600' },
  'classification': { label: 'Classificação', bg: 'bg-violet-500', text: 'text-violet-600' },
  'enrichment_agent': { label: 'Enriquecimento', bg: 'bg-amber-500', text: 'text-amber-600' },
  'learning': { label: 'Aprendizado', bg: 'bg-pink-500', text: 'text-pink-600' },
  'learning_agent': { label: 'Agente', bg: 'bg-indigo-500', text: 'text-indigo-600' },
  'embedding_generation': { label: 'Embeddings', bg: 'bg-gray-400', text: 'text-gray-600' },
};

export const EMOTION_CONFIG: Record<number, { label: string; color: string; bgColor: string; emoji: string }> = {
  0: { label: "Sem classificação", color: "text-gray-400", bgColor: "bg-gray-100", emoji: "❓" },
  1: { label: "Muito positivo", color: "text-green-600", bgColor: "bg-green-50", emoji: "😊" },
  2: { label: "Positivo", color: "text-emerald-600", bgColor: "bg-emerald-50", emoji: "🙂" },
  3: { label: "Neutro", color: "text-gray-600", bgColor: "bg-gray-50", emoji: "😐" },
  4: { label: "Irritado", color: "text-orange-600", bgColor: "bg-orange-50", emoji: "😤" },
  5: { label: "Muito irritado", color: "text-red-600", bgColor: "bg-red-50", emoji: "😠" },
};

export function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}
