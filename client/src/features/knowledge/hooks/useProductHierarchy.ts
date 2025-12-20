import { useMemo } from "react";
import type { ProductCatalogItem } from "../../../types";

export interface ProductHierarchy<T> {
  name: string;
  productId?: number;
  items: T[];
  children: ProductHierarchy<T>[];
}

interface UseProductHierarchyOptions<T> {
  items: T[];
  products: ProductCatalogItem[];
  getProductIds: (item: T) => number[] | undefined | null;
}

export function useProductHierarchy<T>({ items, products, getProductIds }: UseProductHierarchyOptions<T>) {
  const hierarchy = useMemo(() => {
    const productMap = new Map<string, ProductHierarchy<T>>();
    const unassigned: T[] = [];

    const mainProducts = [...new Set(products.map(p => p.produto))];
    mainProducts.forEach(name => {
      productMap.set(name, { name, items: [], children: [] });
    });

    items.forEach(item => {
      const itemProductIds = getProductIds(item);
      if (!itemProductIds || itemProductIds.length === 0) {
        unassigned.push(item);
        return;
      }

      const itemProducts = products.filter(p => itemProductIds.includes(p.id));
      const addedToPaths = new Set<string>();

      itemProducts.forEach(product => {
        const productNode = productMap.get(product.produto);
        if (!productNode) return;

        if (product.subproduto) {
          const subPath = `${product.produto}|${product.subproduto}`;
          if (!addedToPaths.has(subPath)) {
            let subNode = productNode.children.find(c => c.name === product.subproduto);
            if (!subNode) {
              subNode = { name: product.subproduto, productId: product.id, items: [], children: [] };
              productNode.children.push(subNode);
            }
            subNode.items.push(item);
            addedToPaths.add(subPath);
          }
        } else {
          if (!addedToPaths.has(product.produto)) {
            productNode.items.push(item);
            addedToPaths.add(product.produto);
          }
        }
      });
    });

    const result: ProductHierarchy<T>[] = [];
    mainProducts.forEach(name => {
      const node = productMap.get(name);
      if (node && (node.items.length > 0 || node.children.length > 0)) {
        result.push(node);
      }
    });

    if (unassigned.length > 0) {
      result.push({ name: "Sem produto", items: unassigned, children: [] });
    }

    return result;
  }, [items, products, getProductIds]);

  return { hierarchy };
}
