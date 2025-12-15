import { db } from "../../../db.js";
import { productsCatalog, type ProductCatalog, type InsertProductCatalog } from "../../../../shared/schema.js";
import { eq, asc } from "drizzle-orm";
import { createCrudStorage } from "../../../shared/storage/index.js";

const baseCrud = createCrudStorage<ProductCatalog, InsertProductCatalog>({
  table: productsCatalog,
  idColumn: productsCatalog.id,
  orderByColumn: productsCatalog.produto,
  orderDirection: "asc",
  updatedAtKey: "updatedAt",
});

export const productCatalogStorage = {
  async getAll(): Promise<ProductCatalog[]> {
    return db
      .select()
      .from(productsCatalog)
      .orderBy(asc(productsCatalog.produto), asc(productsCatalog.subproduto));
  },

  getById: baseCrud.getById,
  create: baseCrud.create,
  update: baseCrud.update,
  delete: baseCrud.delete,

  async getDistinctProdutos(): Promise<string[]> {
    const result = await db
      .selectDistinct({ produto: productsCatalog.produto })
      .from(productsCatalog)
      .orderBy(asc(productsCatalog.produto));
    return result.map(r => r.produto);
  },

  async getDistinctSubprodutos(produto?: string): Promise<string[]> {
    let query = db
      .selectDistinct({ subproduto: productsCatalog.subproduto })
      .from(productsCatalog);
    
    if (produto) {
      query = query.where(eq(productsCatalog.produto, produto)) as typeof query;
    }
    
    const result = await query.orderBy(asc(productsCatalog.subproduto));
    return result.map(r => r.subproduto).filter((s): s is string => s !== null);
  },

  async getFullNames(): Promise<string[]> {
    const result = await db
      .select({ fullName: productsCatalog.fullName })
      .from(productsCatalog)
      .orderBy(asc(productsCatalog.fullName));
    return result.map(r => r.fullName);
  },

  async resolveProductContext(productId?: number): Promise<string | undefined> {
    if (!productId) return undefined;
    
    const product = await this.getById(productId);
    if (!product) return undefined;
    
    return product.subproduto 
      ? `${product.produto} > ${product.subproduto}` 
      : product.produto;
  },

  async resolveProductId(product: string, subproduct?: string): Promise<{ id: number; produto: string; subproduto: string | null } | null> {
    const products = await this.getAll();
    const productLower = product.toLowerCase().trim();
    const subproductLower = subproduct?.toLowerCase().trim();

    const scored = products.map(p => {
      const produtoLower = p.produto.toLowerCase();
      const fullNameLower = p.fullName.toLowerCase();
      const subprodutoLower = p.subproduto?.toLowerCase();
      
      let score = 0;
      let isMatch = false;

      // When subproduct is provided in the search, prioritize subproduct matches
      if (subproductLower) {
        if (p.subproduto) {
          const subMatch = subproductLower === subprodutoLower || 
                           subproductLower.includes(subprodutoLower) || 
                           subprodutoLower.includes(subproductLower);
          const prodMatch = productLower === produtoLower || 
                            productLower.includes(produtoLower) || 
                            produtoLower.includes(productLower);
          
          if (subMatch && prodMatch) {
            isMatch = true;
            if (subproductLower === subprodutoLower && productLower === produtoLower) {
              score = 100; // Exact match on both product and subproduct
            } else if (subproductLower === subprodutoLower) {
              score = 90;
            } else {
              score = 70;
            }
          }
        }
        // When subproduct is provided, parent products without subproduct get very low score
        // to ensure subproduct matches always win
      } else {
        // No subproduct in search - prioritize parent products
        if (fullNameLower === productLower) {
          isMatch = true;
          score = 100;
        } else if (produtoLower === productLower && !p.subproduto) {
          // Exact match on product name AND no subproduct = parent product
          isMatch = true;
          score = 95;
        } else if (produtoLower === productLower && p.subproduto) {
          // Exact match on product but HAS subproduct = lower priority
          isMatch = true;
          score = 50;
        } else if (productLower.includes(produtoLower) || produtoLower.includes(productLower)) {
          isMatch = true;
          score = p.subproduto ? 30 : 60;
        } else if (fullNameLower.includes(productLower) || productLower.includes(fullNameLower)) {
          isMatch = true;
          score = 40;
        }
      }

      return { ...p, score, isMatch };
    });

    const matches = scored.filter(p => p.isMatch);
    if (matches.length === 0) {
      console.warn(`[ProductCatalog] No match found for product="${product}", subproduct="${subproduct || 'none'}"`);
      return null;
    }

    matches.sort((a, b) => b.score - a.score);
    const best = matches[0];
    
    return {
      id: best.id,
      produto: best.produto,
      subproduto: best.subproduto
    };
  },
};
