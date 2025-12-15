import type { HierarchyNode } from "../hooks/useKnowledgeBase";

export interface NodeStats {
  subproductCount: number;
  subjectCount: number;
  intentCount: number;
  articleCount: number;
}

export const LEVEL_LABELS: Record<string, string> = {
  produto: "Produto",
  subproduto: "Subproduto",
  assunto: "Assunto",
  intencao: "Intenção",
};

export const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  produto: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  subproduto: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  assunto: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  intencao: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export function getNodeStats(node: HierarchyNode): NodeStats {
  let subproductCount = 0;
  let subjectCount = 0;
  let intentCount = 0;
  let articleCount = node.articles.length;

  for (const child of node.children) {
    if (child.level === "subproduto") subproductCount++;
    else if (child.level === "assunto") subjectCount++;
    else if (child.level === "intencao") intentCount++;
    
    const childStats = getNodeStats(child);
    subproductCount += childStats.subproductCount;
    subjectCount += childStats.subjectCount;
    intentCount += childStats.intentCount;
    articleCount += childStats.articleCount;
  }

  return { subproductCount, subjectCount, intentCount, articleCount };
}

export interface StatBadge {
  count: number;
  label: string;
}

export function getStatBadges(stats: NodeStats, level: string): StatBadge[] {
  const badges: StatBadge[] = [];
  
  if (level === "produto" && stats.subproductCount > 0) {
    badges.push({ count: stats.subproductCount, label: stats.subproductCount === 1 ? "subproduto" : "subprodutos" });
  }
  if ((level === "produto" || level === "subproduto") && stats.subjectCount > 0) {
    badges.push({ count: stats.subjectCount, label: stats.subjectCount === 1 ? "assunto" : "assuntos" });
  }
  if ((level !== "intencao") && stats.intentCount > 0) {
    badges.push({ count: stats.intentCount, label: stats.intentCount === 1 ? "intenção" : "intenções" });
  }
  
  return badges;
}
