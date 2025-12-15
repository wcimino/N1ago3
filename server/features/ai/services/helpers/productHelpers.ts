import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";

export interface ResolvedProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

export async function resolveProductById(productId: number | undefined | null): Promise<ResolvedProduct | null> {
  if (!productId) return null;
  
  const product = await productCatalogStorage.getById(productId);
  if (!product) return null;
  
  const fullName = product.subproduto 
    ? `${product.produto} - ${product.subproduto}`
    : product.produto;
  
  return {
    id: product.id,
    produto: product.produto,
    subproduto: product.subproduto,
    fullName,
  };
}

export async function resolveProductByName(
  produto: string | null | undefined,
  subproduto?: string | null
): Promise<ResolvedProduct | null> {
  if (!produto) return null;
  
  const resolved = await productCatalogStorage.resolveProductId(produto, subproduto ?? undefined);
  if (!resolved) return null;
  
  const fullName = resolved.subproduto 
    ? `${resolved.produto} - ${resolved.subproduto}`
    : resolved.produto;
  
  return {
    id: resolved.id,
    produto: resolved.produto,
    subproduto: resolved.subproduto,
    fullName,
  };
}

export function formatProductName(
  produto: string | null | undefined,
  subproduto: string | null | undefined
): string {
  if (!produto) return '';
  return subproduto ? `${produto} - ${subproduto}` : produto;
}
