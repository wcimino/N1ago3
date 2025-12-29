import type { CoverageLevel } from "../types";

export function getCoverageColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export function getCoverageBarColor(coverage: CoverageLevel | string): string {
  if (coverage === "good") return "bg-green-500";
  if (coverage === "medium") return "bg-yellow-500";
  if (coverage === "low") return "bg-red-500";
  return "bg-gray-400";
}

export function getCoverageLevel(score: number | null): CoverageLevel {
  if (score === null) return "unknown";
  if (score >= 70) return "good";
  if (score >= 50) return "medium";
  return "low";
}

export interface CoverageBadgeStyle {
  bg: string;
  text: string;
  label: string;
}

export function getCoverageBadge(coverage: CoverageLevel | string): CoverageBadgeStyle {
  switch (coverage) {
    case "good":
      return { bg: "bg-green-100", text: "text-green-700", label: "Boa" };
    case "medium":
      return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Média" };
    case "low":
      return { bg: "bg-red-100", text: "text-red-700", label: "Baixa" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-600", label: "N/A" };
  }
}
