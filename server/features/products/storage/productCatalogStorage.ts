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

  async resolveProductId(product: string, subproduct?: string): Promise<{ id: number; produto: string; subproduto: string | null } | null> {
    const products = await this.getAll();
    const productLower = product.toLowerCase();
    const subproductLower = subproduct?.toLowerCase();

    const matched = products.find(p => {
      const produtoLower = p.produto.toLowerCase();
      const fullNameLower = p.fullName.toLowerCase();
      const produtoMatch = productLower.includes(produtoLower) || 
                           produtoLower.includes(productLower) ||
                           productLower.includes(fullNameLower) ||
                           fullNameLower.includes(productLower);
      
      if (!produtoMatch) return false;
      
      if (subproductLower && p.subproduto) {
        const subprodutoLower = p.subproduto.toLowerCase();
        return subproductLower.includes(subprodutoLower) || subprodutoLower.includes(subproductLower);
      }
      
      return true;
    });

    if (!matched) return null;
    
    return {
      id: matched.id,
      produto: matched.produto,
      subproduto: matched.subproduto
    };
  },
};
