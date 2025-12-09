import { db } from "../../../db.js";
import { ifoodProducts, type IfoodProduct, type InsertIfoodProduct } from "../../../../shared/schema.js";
import { eq, asc } from "drizzle-orm";

export const productCatalogStorage = {
  async getAll(): Promise<IfoodProduct[]> {
    return db
      .select()
      .from(ifoodProducts)
      .orderBy(asc(ifoodProducts.produto), asc(ifoodProducts.subproduto));
  },

  async getById(id: number): Promise<IfoodProduct | null> {
    const result = await db
      .select()
      .from(ifoodProducts)
      .where(eq(ifoodProducts.id, id))
      .limit(1);
    return result[0] || null;
  },

  async getDistinctProdutos(): Promise<string[]> {
    const result = await db
      .selectDistinct({ produto: ifoodProducts.produto })
      .from(ifoodProducts)
      .orderBy(asc(ifoodProducts.produto));
    return result.map(r => r.produto);
  },

  async getDistinctSubprodutos(produto?: string): Promise<string[]> {
    let query = db
      .selectDistinct({ subproduto: ifoodProducts.subproduto })
      .from(ifoodProducts);
    
    if (produto) {
      query = query.where(eq(ifoodProducts.produto, produto)) as typeof query;
    }
    
    const result = await query.orderBy(asc(ifoodProducts.subproduto));
    return result.map(r => r.subproduto).filter((s): s is string => s !== null);
  },

  async create(data: InsertIfoodProduct): Promise<IfoodProduct> {
    const [result] = await db
      .insert(ifoodProducts)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  },

  async update(id: number, data: Partial<InsertIfoodProduct>): Promise<IfoodProduct | null> {
    const [result] = await db
      .update(ifoodProducts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(ifoodProducts.id, id))
      .returning();
    return result || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(ifoodProducts)
      .where(eq(ifoodProducts.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  async getFullNames(): Promise<string[]> {
    const result = await db
      .select({ fullName: ifoodProducts.fullName })
      .from(ifoodProducts)
      .orderBy(asc(ifoodProducts.fullName));
    return result.map(r => r.fullName);
  },
};
