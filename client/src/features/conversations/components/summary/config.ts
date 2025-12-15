export const emotionConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "bg-green-100 text-green-700", emoji: "😊" },
  2: { label: "Positivo", color: "bg-emerald-100 text-emerald-700", emoji: "🙂" },
  3: { label: "Neutro", color: "bg-gray-100 text-gray-600", emoji: "😐" },
  4: { label: "Irritado", color: "bg-orange-100 text-orange-700", emoji: "😤" },
  5: { label: "Muito irritado", color: "bg-red-100 text-red-700", emoji: "😠" },
};

export const severityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-green-100 text-green-700" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700" },
};
