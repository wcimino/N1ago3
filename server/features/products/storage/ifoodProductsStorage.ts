import { db } from "../../../db.js";
import { ifoodProducts, type IfoodProduct, type InsertIfoodProduct } from "../../../../shared/schema.js";
import { eq, asc, and, type SQL } from "drizzle-orm";

export const ifoodProductsStorage = {
  async getAll(): Promise<IfoodProduct[]> {
    return db
      .select()
      .from(ifoodProducts)
      .orderBy(asc(ifoodProducts.produto), asc(ifoodProducts.subproduto), asc(ifoodProducts.categoria1), asc(ifoodProducts.categoria2));
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

  async getDistinctCategorias1(produto?: string, subproduto?: string): Promise<string[]> {
    const conditions: SQL[] = [];
    if (produto) conditions.push(eq(ifoodProducts.produto, produto));
    if (subproduto) conditions.push(eq(ifoodProducts.subproduto, subproduto));
    
    const result = await db
      .selectDistinct({ categoria1: ifoodProducts.categoria1 })
      .from(ifoodProducts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(ifoodProducts.categoria1));
    
    return result.map(r => r.categoria1);
  },

  async getDistinctCategorias2(produto?: string, subproduto?: string, categoria1?: string): Promise<string[]> {
    const conditions: SQL[] = [];
    if (produto) conditions.push(eq(ifoodProducts.produto, produto));
    if (subproduto) conditions.push(eq(ifoodProducts.subproduto, subproduto));
    if (categoria1) conditions.push(eq(ifoodProducts.categoria1, categoria1));
    
    const result = await db
      .selectDistinct({ categoria2: ifoodProducts.categoria2 })
      .from(ifoodProducts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(ifoodProducts.categoria2));
    
    return result.map(r => r.categoria2).filter((c): c is string => c !== null);
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
