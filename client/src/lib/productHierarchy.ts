export type ProductLevelType = "produto" | "subproduto" | "assunto" | "intencao";

export interface ProductAncestry {
  produto: string;
  subproduto: string | null;
}

export interface ProductData {
  id?: number;
  produto: string;
  subproduto: string | null;
}

export interface ProductTreeNode {
  name: string;
  level: ProductLevelType;
  children: ProductTreeNode[];
  productId?: number;
  ancestry: ProductAncestry;
  fullPath: string;
}

export const LEVEL_LABELS: Record<ProductLevelType, string> = {
  produto: "Produto",
  subproduto: "Subproduto",
  assunto: "Assunto",
  intencao: "Intenção",
};

export const LEVEL_COLORS: Record<ProductLevelType, { bg: string; text: string; border: string }> = {
  produto: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  subproduto: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  assunto: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
  intencao: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
};

export function getNodeKey(node: ProductTreeNode): string {
  const parts = [node.ancestry.produto];
  if (node.level === "subproduto") parts.push(`sub:${node.name}`);
  return parts.join("|");
}

export function getDisplayPath(ancestry: ProductAncestry, currentName?: string): string {
  const parts = [ancestry.produto];
  if (ancestry.subproduto) parts.push(ancestry.subproduto);
  if (currentName) parts.push(currentName);
  return parts.join(" > ");
}

export function getNextLevels(level: ProductLevelType): ProductLevelType[] {
  switch (level) {
    case "produto": return ["subproduto"];
    default: return [];
  }
}

export function buildProductTree<T extends ProductData>(products: T[]): ProductTreeNode[] {
  const tree: ProductTreeNode[] = [];
  const produtoMap = new Map<string, ProductTreeNode>();

  for (const product of products) {
    let produtoNode = produtoMap.get(product.produto);
    if (!produtoNode) {
      produtoNode = {
        name: product.produto,
        level: "produto",
        children: [],
        ancestry: { produto: product.produto, subproduto: null },
        fullPath: product.produto,
      };
      produtoMap.set(product.produto, produtoNode);
      tree.push(produtoNode);
    }

    if (!product.subproduto) {
      produtoNode.productId = product.id;
      continue;
    }

    let subprodutoNode = produtoNode.children.find(
      c => c.name === product.subproduto && c.level === "subproduto"
    );
    if (!subprodutoNode) {
      subprodutoNode = {
        name: product.subproduto,
        level: "subproduto",
        children: [],
        ancestry: { produto: product.produto, subproduto: product.subproduto },
        fullPath: `${product.produto} > ${product.subproduto}`,
        productId: product.id,
      };
      produtoNode.children.push(subprodutoNode);
    } else {
      subprodutoNode.productId = product.id;
    }
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

export interface ProductNodeWithSubjects {
  id: number;
  name: string;
  fullPath: string;
  children: ProductNodeWithSubjects[];
  subjects: Array<{ id: number; productCatalogId: number; name: string; synonyms: string[]; productName?: string | null }>;
}

export function buildProductTreeWithSubjects<
  P extends { id: number; produto: string; subproduto: string | null; fullName: string },
  S extends { id: number; productCatalogId: number; name: string; synonyms: string[]; productName?: string | null }
>(products: P[], subjects: S[]): ProductNodeWithSubjects[] {
  const rootNodes = new Map<string, ProductNodeWithSubjects>();
  
  const rootProducts = products.filter(p => !p.subproduto);
  const subProducts = products.filter(p => p.subproduto);
  
  for (const p of rootProducts) {
    rootNodes.set(p.produto, {
      id: p.id,
      name: p.produto,
      fullPath: p.fullName,
      children: [],
      subjects: subjects.filter(s => s.productCatalogId === p.id),
    });
  }
  
  for (const p of subProducts) {
    let parentNode = rootNodes.get(p.produto);
    
    if (!parentNode) {
      parentNode = {
        id: -1,
        name: p.produto,
        fullPath: p.produto,
        children: [],
        subjects: [],
      };
      rootNodes.set(p.produto, parentNode);
    }
    
    parentNode.children.push({
      id: p.id,
      name: p.subproduto!,
      fullPath: p.fullName,
      children: [],
      subjects: subjects.filter(s => s.productCatalogId === p.id),
    });
  }
  
  for (const node of rootNodes.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return [...rootNodes.values()].sort((a, b) => a.name.localeCompare(b.name));
}
