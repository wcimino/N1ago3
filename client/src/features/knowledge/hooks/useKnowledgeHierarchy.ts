import { useState, useMemo } from "react";
import { ProductLevelType } from "../../../lib/productHierarchy";
import type { KnowledgeSubject, KnowledgeIntent } from "../../../types";
import type { CatalogProduct, KnowledgeBaseArticle, IntentStatistic } from "./useKnowledgeQueries";

export interface HierarchyNode {
  name: string;
  level: ProductLevelType;
  fullPath: string;
  children: HierarchyNode[];
  articles: KnowledgeBaseArticle[];
  productId?: number;
  subjectId?: number;
  intentId?: number;
}

function buildHierarchy(
  products: CatalogProduct[],
  subjects: KnowledgeSubject[],
  intents: KnowledgeIntent[],
  articles: KnowledgeBaseArticle[]
): HierarchyNode[] {
  const productNodes = new Map<string, HierarchyNode>();
  const subproductNodes = new Map<string, HierarchyNode>();
  
  for (const product of products) {
    const isGenericProduct = !product.subproduto;
    
    if (!productNodes.has(product.produto)) {
      productNodes.set(product.produto, {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
        productId: isGenericProduct ? product.id : undefined,
      });
    } else {
      const existingNode = productNodes.get(product.produto)!;
      if (isGenericProduct && !existingNode.productId) {
        existingNode.productId = product.id;
      }
    }
    
    if (product.subproduto) {
      const prodNode = productNodes.get(product.produto)!;
      const subprodKey = `${product.produto}|${product.subproduto}`;
      if (!subproductNodes.has(subprodKey)) {
        const subprodNode: HierarchyNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
          productId: product.id,
        };
        subproductNodes.set(subprodKey, subprodNode);
        prodNode.children.push(subprodNode);
      } else {
        const existingSubprod = subproductNodes.get(subprodKey)!;
        if (!existingSubprod.productId) {
          existingSubprod.productId = product.id;
        }
      }
    }
  }
  
  for (const subject of subjects) {
    const product = products.find(p => p.id === subject.productCatalogId);
    if (!product) continue;
    
    const isGenericProduct = !product.subproduto;
    
    let prodNode = productNodes.get(product.produto);
    if (!prodNode) {
      const genericProduct = products.find(p => p.produto === product.produto && !p.subproduto);
      prodNode = {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
        productId: genericProduct?.id,
      };
      productNodes.set(product.produto, prodNode);
    } else if (isGenericProduct && !prodNode.productId) {
      prodNode.productId = product.id;
    }
    
    let parentNode: HierarchyNode = prodNode;
    let basePath = product.produto;
    
    if (product.subproduto) {
      const subprodKey = `${product.produto}|${product.subproduto}`;
      let subprodNode = subproductNodes.get(subprodKey);
      if (!subprodNode) {
        subprodNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
          productId: product.id,
        };
        subproductNodes.set(subprodKey, subprodNode);
        prodNode.children.push(subprodNode);
      } else if (!subprodNode.productId) {
        subprodNode.productId = product.id;
      }
      parentNode = subprodNode;
      basePath = `${product.produto} > ${product.subproduto}`;
    }
    
    let subjectNode = parentNode.children.find(c => c.subjectId === subject.id);
    if (!subjectNode) {
      subjectNode = {
        name: subject.name,
        level: "assunto",
        fullPath: `${basePath} > ${subject.name}`,
        children: [],
        articles: [],
        subjectId: subject.id,
      };
      parentNode.children.push(subjectNode);
    }
  }
  
  const findSubjectNode = (subjectId: number): HierarchyNode | null => {
    for (const prodNode of productNodes.values()) {
      const directSubject = prodNode.children.find(c => c.subjectId === subjectId);
      if (directSubject) return directSubject;
      
      for (const child of prodNode.children) {
        if (child.level === "subproduto") {
          const subjectInSubprod = child.children.find(c => c.subjectId === subjectId);
          if (subjectInSubprod) return subjectInSubprod;
        }
      }
    }
    return null;
  };
  
  for (const intent of intents) {
    const subjectNode = findSubjectNode(intent.subjectId);
    if (!subjectNode) continue;
    
    let intentNode = subjectNode.children.find(c => c.intentId === intent.id);
    if (!intentNode) {
      intentNode = {
        name: intent.name,
        level: "intencao",
        fullPath: `${subjectNode.fullPath} > ${intent.name}`,
        children: [],
        articles: [],
        subjectId: intent.subjectId,
        intentId: intent.id,
      };
      subjectNode.children.push(intentNode);
    }
  }
  
  const findIntentNode = (intentId: number): HierarchyNode | null => {
    for (const prodNode of productNodes.values()) {
      for (const child of prodNode.children) {
        if (child.level === "assunto") {
          const intentNode = child.children.find(c => c.intentId === intentId);
          if (intentNode) return intentNode;
        } else if (child.level === "subproduto") {
          for (const subjectNode of child.children) {
            const intentNode = subjectNode.children.find(c => c.intentId === intentId);
            if (intentNode) return intentNode;
          }
        }
      }
    }
    return null;
  };
  
  const UNCLASSIFIED_KEY = "__sem_produto__";
  
  const getOrCreateUnclassifiedNode = (): HierarchyNode => {
    let node = productNodes.get(UNCLASSIFIED_KEY);
    if (!node) {
      node = {
        name: "Sem produto",
        level: "produto",
        fullPath: "Sem produto",
        children: [],
        articles: [],
      };
      productNodes.set(UNCLASSIFIED_KEY, node);
    }
    return node;
  };
  
  const placeArticleInFallback = (article: KnowledgeBaseArticle) => {
    if (!article.productId) {
      getOrCreateUnclassifiedNode().articles.push(article);
      return;
    }
    
    const product = products.find(p => p.id === article.productId);
    if (!product) {
      getOrCreateUnclassifiedNode().articles.push(article);
      return;
    }
    
    let prodNode = productNodes.get(product.produto);
    if (!prodNode) {
      prodNode = {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
        productId: !product.subproduto ? product.id : undefined,
      };
      productNodes.set(product.produto, prodNode);
    }
    
    if (product.subproduto) {
      const subprodKey = `${product.produto}|${product.subproduto}`;
      let subprodNode = subproductNodes.get(subprodKey);
      if (!subprodNode) {
        subprodNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
          productId: product.id,
        };
        subproductNodes.set(subprodKey, subprodNode);
        prodNode.children.push(subprodNode);
      }
      subprodNode.articles.push(article);
    } else {
      prodNode.articles.push(article);
    }
  };
  
  for (const article of articles) {
    if (article.intentId) {
      const intentNode = findIntentNode(article.intentId);
      if (intentNode) {
        intentNode.articles.push(article);
      } else {
        placeArticleInFallback(article);
      }
    } else if (article.subjectId) {
      const subjectNode = findSubjectNode(article.subjectId);
      if (subjectNode) {
        subjectNode.articles.push(article);
      } else {
        placeArticleInFallback(article);
      }
    } else {
      placeArticleInFallback(article);
    }
  }
  
  const sortNodeRecursively = (node: HierarchyNode): void => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    node.articles.sort((a, b) => (a.question || '').localeCompare(b.question || '', 'pt-BR'));
    for (const child of node.children) {
      sortNodeRecursively(child);
    }
  };

  const result = Array.from(productNodes.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const node of result) {
    sortNodeRecursively(node);
  }
  return result;
}

interface UseKnowledgeHierarchyOptions {
  catalogProducts: CatalogProduct[];
  subjects: KnowledgeSubject[];
  intents: KnowledgeIntent[];
  articles: KnowledgeBaseArticle[];
  intentStatistics: IntentStatistic[];
  embeddingStats?: { withEmbedding: number } | null;
}

export function useKnowledgeHierarchy({
  catalogProducts,
  subjects,
  intents,
  articles,
  intentStatistics,
  embeddingStats,
}: UseKnowledgeHierarchyOptions) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const hierarchy = useMemo(
    () => buildHierarchy(catalogProducts, subjects, intents, articles),
    [catalogProducts, subjects, intents, articles]
  );

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getAllPaths = (nodes: HierarchyNode[]): string[] => {
    const paths: string[] = [];
    const collect = (n: HierarchyNode) => {
      paths.push(n.fullPath);
      n.children.forEach(collect);
    };
    nodes.forEach(collect);
    return paths;
  };

  const expandAllPaths = () => {
    const allPaths = getAllPaths(hierarchy);
    setExpandedPaths(new Set(allPaths));
  };

  const collapseAllPaths = () => {
    setExpandedPaths(new Set());
  };

  const intentViewCountMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const stat of intentStatistics) {
      map.set(stat.intentId, stat.viewCount);
    }
    return map;
  }, [intentStatistics]);

  const catalogStats = useMemo(() => {
    const uniqueProducts = new Set(catalogProducts.map(p => p.produto));
    const uniqueSubproducts = catalogProducts.filter(p => p.subproduto).length;
    return {
      productsCount: uniqueProducts.size,
      subproductsCount: uniqueSubproducts,
      subjectsCount: subjects.length,
      intentsCount: intents.length,
      articlesCount: articles.length,
      embeddingsCount: embeddingStats?.withEmbedding ?? 0,
    };
  }, [catalogProducts, subjects, intents, articles, embeddingStats]);

  return {
    hierarchy,
    expandedPaths,
    togglePath,
    expandAllPaths,
    collapseAllPaths,
    intentViewCountMap,
    catalogStats,
  };
}
