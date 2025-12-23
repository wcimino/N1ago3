export type ProductLevelType = "produto" | "subproduto";

export interface ProductAncestry {
  produto: string;
  produtoExternalId: string;
}

export interface ProductData {
  id: number;
  externalId: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface SubproductData {
  id: number;
  externalId: string;
  name: string;
  produtoId: string;
}

export interface ProductTreeNode {
  name: string;
  level: ProductLevelType;
  children: ProductTreeNode[];
  id: number;
  externalId: string;
  icon?: string | null;
  color?: string | null;
  ancestry: ProductAncestry;
  fullPath: string;
}

export const LEVEL_LABELS: Record<ProductLevelType, string> = {
  produto: "Produto",
  subproduto: "Subproduto",
};

export const LEVEL_COLORS: Record<ProductLevelType, { bg: string; text: string; border: string }> = {
  produto: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  subproduto: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
};

export function getNodeKey(node: ProductTreeNode): string {
  return node.externalId;
}

export function getDisplayPath(ancestry: ProductAncestry, currentName?: string): string {
  const parts = [ancestry.produto];
  if (currentName) parts.push(currentName);
  return parts.join(" > ");
}

export function getNextLevels(level: ProductLevelType): ProductLevelType[] {
  switch (level) {
    case "produto": return ["subproduto"];
    default: return [];
  }
}

export function buildProductTree(products: ProductData[], subproducts: SubproductData[]): ProductTreeNode[] {
  const tree: ProductTreeNode[] = [];

  for (const product of products) {
    const productNode: ProductTreeNode = {
      name: product.name,
      level: "produto",
      children: [],
      id: product.id,
      externalId: product.externalId,
      icon: product.icon,
      color: product.color,
      ancestry: { produto: product.name, produtoExternalId: product.externalId },
      fullPath: product.name,
    };

    const productSubproducts = subproducts.filter(s => s.produtoId === product.externalId);
    for (const subproduct of productSubproducts) {
      productNode.children.push({
        name: subproduct.name,
        level: "subproduto",
        children: [],
        id: subproduct.id,
        externalId: subproduct.externalId,
        ancestry: { produto: product.name, produtoExternalId: product.externalId },
        fullPath: `${product.name} > ${subproduct.name}`,
      });
    }

    productNode.children.sort((a, b) => a.name.localeCompare(b.name));
    tree.push(productNode);
  }

  return tree.sort((a, b) => a.name.localeCompare(b.name));
}

export function countNodesInTree(node: ProductTreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodesInTree(child);
  }
  return count;
}
