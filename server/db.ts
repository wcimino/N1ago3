import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

const basePool = new Pool({ connectionString: process.env.DATABASE_URL });

const instrumentedPool = new Proxy(basePool, {
  get(target, prop, receiver) {
    if (prop === 'query') {
      return async function(...args: any[]) {
        const queryText = typeof args[0] === 'string' 
          ? args[0] 
          : args[0]?.text || '';
        
        if (queryText.includes('query_logs') || queryText.includes('query_stats')) {
          return target.query.apply(target, args as any);
        }
        
        const start = Date.now();
        try {
          const result = await target.query.apply(target, args as any) as unknown as { rowCount?: number | null };
          const duration = Date.now() - start;
          
          import("./services/queryLogger").then(({ logQuery }) => {
            logQuery(queryText, duration, result?.rowCount ?? undefined, "pool");
          }).catch(() => {});
          
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          
          import("./services/queryLogger").then(({ logQuery }) => {
            logQuery(queryText, duration, undefined, "pool-error");
          }).catch(() => {});
          
          throw error;
        }
      };
    }
    return Reflect.get(target, prop, receiver);
  }
});

export const pool = instrumentedPool as typeof basePool;
export const db = drizzle({ client: pool, schema });
