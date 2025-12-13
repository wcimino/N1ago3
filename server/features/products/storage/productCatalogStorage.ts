import { db } from "../../../db.js";
import { productsCatalog, type ProductCatalog, type InsertProductCatalog } from "../../../../shared/schema.js";
import { eq, asc } from "drizzle-orm";

export const productCatalogStorage = {
  async getAll(): Promise<ProductCatalog[]> {
    return db
      .select()
      .from(productsCatalog)
      .orderBy(asc(productsCatalog.produto), asc(productsCatalog.subproduto));
  },

  async getById(id: number): Promise<ProductCatalog | null> {
    const result = await db
      .select()
      .from(productsCatalog)
      .where(eq(productsCatalog.id, id))
      .limit(1);
    return result[0] || null;
  },

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

  async create(data: InsertProductCatalog): Promise<ProductCatalog> {
    const [result] = await db
      .insert(productsCatalog)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  },

  async update(id: number, data: Partial<InsertProductCatalog>): Promise<ProductCatalog | null> {
    const [result] = await db
      .update(productsCatalog)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(productsCatalog.id, id))
      .returning();
    return result || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(productsCatalog)
      .where(eq(productsCatalog.id, id));
    return (result.rowCount ?? 0) > 0;
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
      const produtoMatch = p.produto.toLowerCase().includes(productLower) || 
                           p.fullName.toLowerCase().includes(productLower);
      
      if (!produtoMatch) return false;
      
      if (subproductLower && p.subproduto) {
        return p.subproduto.toLowerCase().includes(subproductLower);
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
