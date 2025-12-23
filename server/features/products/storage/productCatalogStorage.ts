import { db } from "../../../db.js";
import { productsCatalog, subproductsCatalog, type ProductCatalog, type InsertProductCatalog, type SubproductCatalog, type InsertSubproductCatalog } from "../../../../shared/schema.js";
import { eq, asc } from "drizzle-orm";
import { createCrudStorage } from "../../../shared/storage/index.js";

const baseProductCrud = createCrudStorage<ProductCatalog, InsertProductCatalog>({
  table: productsCatalog,
  idColumn: productsCatalog.id,
  orderByColumn: productsCatalog.name,
  orderDirection: "asc",
  updatedAtKey: "updatedAt",
});

const baseSubproductCrud = createCrudStorage<SubproductCatalog, InsertSubproductCatalog>({
  table: subproductsCatalog,
  idColumn: subproductsCatalog.id,
  orderByColumn: subproductsCatalog.name,
  orderDirection: "asc",
  updatedAtKey: "updatedAt",
});

export const productCatalogStorage = {
  async getAll(): Promise<ProductCatalog[]> {
    return db
      .select()
      .from(productsCatalog)
      .orderBy(asc(productsCatalog.name));
  },

  getById: baseProductCrud.getById,
  create: baseProductCrud.create,
  update: baseProductCrud.update,
  delete: baseProductCrud.delete,

  async getByExternalId(externalId: string): Promise<ProductCatalog | undefined> {
    const result = await db
      .select()
      .from(productsCatalog)
      .where(eq(productsCatalog.externalId, externalId))
      .limit(1);
    return result[0];
  },

  async getDistinctProdutos(): Promise<string[]> {
    const result = await db
      .select({ name: productsCatalog.name })
      .from(productsCatalog)
      .orderBy(asc(productsCatalog.name));
    return result.map(r => r.name);
  },

  async resolveProductContext(productId?: number): Promise<string | undefined> {
    if (!productId) return undefined;
    
    const product = await this.getById(productId);
    if (!product) return undefined;
    
    return product.name;
  },

  async resolveProductId(productName: string): Promise<{ id: number; name: string; externalId: string } | null> {
    const products = await this.getAll();
    const searchLower = productName.toLowerCase().trim();

    const scored = products.map(p => {
      const nameLower = p.name.toLowerCase();
      
      let score = 0;
      let isMatch = false;

      if (nameLower === searchLower) {
        isMatch = true;
        score = 100;
      } else if (searchLower.includes(nameLower) || nameLower.includes(searchLower)) {
        isMatch = true;
        score = 60;
      }

      return { ...p, score, isMatch };
    });

    const matches = scored.filter(p => p.isMatch);
    if (matches.length === 0) {
      console.warn(`[ProductCatalog] No match found for product="${productName}"`);
      return null;
    }

    matches.sort((a, b) => b.score - a.score);
    const best = matches[0];
    
    return {
      id: best.id,
      name: best.name,
      externalId: best.externalId
    };
  },
};

export const subproductCatalogStorage = {
  async getAll(): Promise<SubproductCatalog[]> {
    return db
      .select()
      .from(subproductsCatalog)
      .orderBy(asc(subproductsCatalog.name));
  },

  getById: baseSubproductCrud.getById,
  create: baseSubproductCrud.create,
  update: baseSubproductCrud.update,
  delete: baseSubproductCrud.delete,

  async getByExternalId(externalId: string): Promise<SubproductCatalog | undefined> {
    const result = await db
      .select()
      .from(subproductsCatalog)
      .where(eq(subproductsCatalog.externalId, externalId))
      .limit(1);
    return result[0];
  },

  async getByProdutoId(produtoId: string): Promise<SubproductCatalog[]> {
    return db
      .select()
      .from(subproductsCatalog)
      .where(eq(subproductsCatalog.produtoId, produtoId))
      .orderBy(asc(subproductsCatalog.name));
  },

  async getDistinctSubprodutos(produtoExternalId?: string): Promise<string[]> {
    let query = db
      .select({ name: subproductsCatalog.name })
      .from(subproductsCatalog);
    
    if (produtoExternalId) {
      query = query.where(eq(subproductsCatalog.produtoId, produtoExternalId)) as typeof query;
    }
    
    const result = await query.orderBy(asc(subproductsCatalog.name));
    return result.map(r => r.name);
  },

  async resolveSubproductId(subproductName: string, produtoExternalId?: string): Promise<{ id: number; name: string; externalId: string; produtoId: string } | null> {
    let subproducts: SubproductCatalog[];
    
    if (produtoExternalId) {
      subproducts = await this.getByProdutoId(produtoExternalId);
    } else {
      subproducts = await this.getAll();
    }

    const searchLower = subproductName.toLowerCase().trim();

    const scored = subproducts.map(s => {
      const nameLower = s.name.toLowerCase();
      
      let score = 0;
      let isMatch = false;

      if (nameLower === searchLower) {
        isMatch = true;
        score = 100;
      } else if (searchLower.includes(nameLower) || nameLower.includes(searchLower)) {
        isMatch = true;
        score = 60;
      }

      return { ...s, score, isMatch };
    });

    const matches = scored.filter(s => s.isMatch);
    if (matches.length === 0) {
      console.warn(`[SubproductCatalog] No match found for subproduct="${subproductName}"`);
      return null;
    }

    matches.sort((a, b) => b.score - a.score);
    const best = matches[0];
    
    return {
      id: best.id,
      name: best.name,
      externalId: best.externalId,
      produtoId: best.produtoId
    };
  },

  async getAllWithProducts(): Promise<Array<SubproductCatalog & { produto: ProductCatalog }>> {
    const subproducts = await this.getAll();
    const products = await productCatalogStorage.getAll();
    
    const productMap = new Map(products.map(p => [p.externalId, p]));
    
    return subproducts.map(s => ({
      ...s,
      produto: productMap.get(s.produtoId)!
    })).filter(s => s.produto);
  }
};
