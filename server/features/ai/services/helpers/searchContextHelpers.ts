import { resolveProductById } from "./productHelpers.js";
import { getClientRequest } from "./summaryHelpers.js";

export interface ClassificationContext {
  productId?: number;
  customerRequestType?: string;
  productConfidence?: number;
  customerRequestTypeConfidence?: number;
}

export async function buildCleanSearchContext(
  summary: string | null | undefined,
  classification: ClassificationContext | undefined
): Promise<string> {
  const parts: string[] = [];

  const resolvedProduct = await resolveProductById(classification?.productId);
  if (resolvedProduct) {
    parts.push(`Produto: ${resolvedProduct.fullName}`);
  }

  const clientRequest = getClientRequest(summary);
  if (clientRequest) {
    parts.push(`Solicitação: ${clientRequest}`);
  }

  if (classification?.customerRequestType) {
    parts.push(`Tipo: ${classification.customerRequestType}`);
  }

  return parts.join("\n");
}

export interface ResolvedClassification {
  product?: string | null;
  subproduct?: string | null;
  customerRequestType?: string | null;
  productConfidence?: number;
  customerRequestTypeConfidence?: number;
}

export async function buildResolvedClassification(
  classification: ClassificationContext | undefined
): Promise<ResolvedClassification | undefined> {
  if (!classification) return undefined;

  const resolvedProduct = await resolveProductById(classification.productId);

  if (resolvedProduct) {
    return {
      product: resolvedProduct.produto,
      subproduct: resolvedProduct.subproduto,
      customerRequestType: classification.customerRequestType,
      productConfidence: classification.productConfidence,
      customerRequestTypeConfidence: classification.customerRequestTypeConfidence,
    };
  }

  if (classification.customerRequestType) {
    return {
      customerRequestType: classification.customerRequestType,
      productConfidence: classification.productConfidence,
      customerRequestTypeConfidence: classification.customerRequestTypeConfidence,
    };
  }

  return undefined;
}
