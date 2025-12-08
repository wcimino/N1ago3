export type ProductLevelType = "produto" | "subproduto" | "categoria1" | "categoria2";

export interface ProductAncestry {
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2?: string | null;
}

export interface ProductData {
  id?: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
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
  categoria1: "Categoria 1",
  categoria2: "Categoria 2",
};

export const LEVEL_COLORS: Record<ProductLevelType, { bg: string; text: string; border: string }> = {
  produto: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  subproduto: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  categoria1: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
  categoria2: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
};

export function getNodeKey(node: ProductTreeNode): string {
  const parts = [node.ancestry.produto];
  if (node.ancestry.subproduto) parts.push(`sub:${node.ancestry.subproduto}`);
  if (node.ancestry.categoria1) parts.push(`c1:${node.ancestry.categoria1}`);
  if (node.level === "categoria2") parts.push(`c2:${node.name}`);
  else if (node.level === "categoria1" && !node.ancestry.subproduto) parts.push(`c1direct:${node.name}`);
  else if (node.level === "subproduto") parts.push(`sub:${node.name}`);
  return parts.join("|");
}

export function getDisplayPath(ancestry: ProductAncestry, currentName?: string): string {
  const parts = [ancestry.produto];
  if (ancestry.subproduto) parts.push(ancestry.subproduto);
  if (ancestry.categoria1) parts.push(ancestry.categoria1);
  if (currentName) parts.push(currentName);
  return parts.join(" > ");
}

export function getNextLevels(level: ProductLevelType): ProductLevelType[] {
  switch (level) {
    case "produto": return ["subproduto", "categoria1"];
    case "subproduto": return ["categoria1"];
    case "categoria1": return ["categoria2"];
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
        ancestry: { produto: product.produto, subproduto: null, categoria1: null },
        fullPath: product.produto,
      };
      produtoMap.set(product.produto, produtoNode);
      tree.push(produtoNode);
    }

    if (!product.subproduto && !product.categoria1 && !product.categoria2) {
      produtoNode.productId = product.id;
      continue;
    }

    if (product.subproduto) {
      let subprodutoNode = produtoNode.children.find(
        c => c.name === product.subproduto && c.level === "subproduto"
      );
      if (!subprodutoNode) {
        subprodutoNode = {
          name: product.subproduto,
          level: "subproduto",
          children: [],
          ancestry: { produto: product.produto, subproduto: product.subproduto, categoria1: null },
          fullPath: `${product.produto} > ${product.subproduto}`,
        };
        produtoNode.children.push(subprodutoNode);
      }

      if (!product.categoria1 && !product.categoria2) {
        subprodutoNode.productId = product.id;
        continue;
      }

      if (product.categoria1) {
        let cat1Node = subprodutoNode.children.find(c => c.name === product.categoria1);
        if (!cat1Node) {
          cat1Node = {
            name: product.categoria1,
            level: "categoria1",
            children: [],
            ancestry: { produto: product.produto, subproduto: product.subproduto, categoria1: product.categoria1 },
            fullPath: `${product.produto} > ${product.subproduto} > ${product.categoria1}`,
          };
          subprodutoNode.children.push(cat1Node);
        }

        if (!product.categoria2) {
          cat1Node.productId = product.id;
          continue;
        }

        let cat2Node = cat1Node.children.find(c => c.name === product.categoria2);
        if (!cat2Node) {
          cat2Node = {
            name: product.categoria2,
            level: "categoria2",
            children: [],
            ancestry: { produto: product.produto, subproduto: product.subproduto, categoria1: product.categoria1 },
            fullPath: `${product.produto} > ${product.subproduto} > ${product.categoria1} > ${product.categoria2}`,
            productId: product.id,
          };
          cat1Node.children.push(cat2Node);
        } else {
          cat2Node.productId = product.id;
        }
      }
    } else if (product.categoria1) {
      let cat1Node = produtoNode.children.find(
        c => c.name === product.categoria1 && c.level === "categoria1"
      );
      if (!cat1Node) {
        cat1Node = {
          name: product.categoria1,
          level: "categoria1",
          children: [],
          ancestry: { produto: product.produto, subproduto: null, categoria1: product.categoria1 },
          fullPath: `${product.produto} > ${product.categoria1}`,
        };
        produtoNode.children.push(cat1Node);
      }

      if (!product.categoria2) {
        cat1Node.productId = product.id;
      } else {
        let cat2Node = cat1Node.children.find(c => c.name === product.categoria2);
        if (!cat2Node) {
          cat2Node = {
            name: product.categoria2,
            level: "categoria2",
            children: [],
            ancestry: { produto: product.produto, subproduto: null, categoria1: product.categoria1 },
            fullPath: `${product.produto} > ${product.categoria1} > ${product.categoria2}`,
            productId: product.id,
          };
          cat1Node.children.push(cat2Node);
        }
      }
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
