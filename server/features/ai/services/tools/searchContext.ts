import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";

export interface SearchContextParams {
  product?: string;
  subproduct?: string;
  limit?: number;
}

export interface ResolvedSearchContext {
  productId: number | undefined;
  resolvedProduct: string | null;
  resolvedSubproduct: string | null;
  limit: number;
}

export async function buildSearchContext(
  params: SearchContextParams,
  defaultLimit: number = 5
): Promise<ResolvedSearchContext> {
  let productId: number | undefined;
  let resolvedProduct: string | null = null;
  let resolvedSubproduct: string | null = null;

  if (params.product) {
    const resolved = await productCatalogStorage.resolveProductId(
      params.product, 
      params.subproduct
    );
    if (resolved) {
      productId = resolved.id;
      resolvedProduct = resolved.produto;
      resolvedSubproduct = resolved.subproduto;
    }
  }

  return {
    productId,
    resolvedProduct,
    resolvedSubproduct,
    limit: params.limit ?? defaultLimit,
  };
}

export interface ToolSearchResponse<T> {
  message: string;
  results: T[];
  resolvedFilters: {
    product: string | null;
    subproduct: string | null;
  };
}

export function createEmptyResponse<T>(
  context: ResolvedSearchContext,
  originalProduct?: string,
  originalSubproduct?: string
): ToolSearchResponse<T> {
  return {
    message: "Nenhum resultado encontrado",
    results: [],
    resolvedFilters: {
      product: context.resolvedProduct || originalProduct || null,
      subproduct: context.resolvedSubproduct || originalSubproduct || null,
    },
  };
}

export function createSuccessResponse<T>(
  results: T[],
  context: ResolvedSearchContext,
  itemLabel: string = "resultados"
): ToolSearchResponse<T> {
  return {
    message: `Encontrados ${results.length} ${itemLabel}`,
    results,
    resolvedFilters: {
      product: context.resolvedProduct,
      subproduct: context.resolvedSubproduct,
    },
  };
}

export function toJsonString<T>(response: ToolSearchResponse<T>): string {
  return JSON.stringify(response);
}
