export { StatsCard } from "./StatsCard";
export { StatsTotalRow } from "./StatsTotalRow";
export { StatsRow } from "./StatsRow";

export const emotionColorMap: Record<number, { colorScheme: "green" | "emerald" | "gray" | "orange" | "red"; customColor?: string; customBg?: string }> = {
  0: { colorScheme: "gray", customColor: "text-gray-400", customBg: "bg-gray-100" },
  1: { colorScheme: "green" },
  2: { colorScheme: "emerald" },
  3: { colorScheme: "gray" },
  4: { colorScheme: "orange" },
  5: { colorScheme: "red" },
};
