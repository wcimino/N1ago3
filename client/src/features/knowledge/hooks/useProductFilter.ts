import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProductCatalogItem } from "../../../types";

interface UseProductFilterOptions {
  productsQueryKey?: string;
  productsQueryFn?: () => Promise<ProductCatalogItem[]>;
}

export function useProductFilter(options: UseProductFilterOptions = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const {
    productsQueryKey = "/api/product-catalog",
    productsQueryFn = async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  } = options;

  const { data: products = [] } = useQuery<ProductCatalogItem[]>({
    queryKey: [productsQueryKey],
    queryFn: productsQueryFn,
  });

  const distinctProducts = useMemo(() => {
    return [...new Set(products.map(p => p.produto))];
  }, [products]);

  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: String(p.id),
      label: p.subproduto ? `${p.produto} - ${p.subproduto}` : p.produto,
    }));
  }, [products]);

  const distinctProductOptions = useMemo(() => {
    return distinctProducts.map(name => ({
      value: name,
      label: name,
    }));
  }, [distinctProducts]);

  const getProductName = (productId: number | null): string | null => {
    if (!productId) return null;
    const product = products.find(p => p.id === productId);
    return product ? (product.subproduto ? `${product.produto} - ${product.subproduto}` : product.produto) : null;
  };

  const getProductIdsForName = (productName: string): number[] => {
    return products
      .filter(p => p.produto === productName)
      .map(p => p.id);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedProductId("");
    setSelectedProduct("");
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedProductId,
    setSelectedProductId,
    selectedProduct,
    setSelectedProduct,
    products,
    distinctProducts,
    productOptions,
    distinctProductOptions,
    getProductName,
    getProductIdsForName,
    clearFilters,
  };
}
