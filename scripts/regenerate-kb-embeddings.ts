import { db } from "../server/db.js";
import { knowledgeBase, knowledgeBaseEmbeddings, productsCatalog } from "../shared/schema/index.js";
import { eq, isNull } from "drizzle-orm";
import { batchGenerateEmbeddings } from "../server/features/ai/services/knowledgeBaseEmbeddingService.js";
import type { KnowledgeBaseArticleWithProduct } from "../server/shared/embeddings/adapters/knowledgeBaseAdapter.js";

async function regenerateEmbeddings() {
  console.log("Starting knowledge base embeddings regeneration...");

  const articles = await db
    .select({
      id: knowledgeBase.id,
      question: knowledgeBase.question,
      answer: knowledgeBase.answer,
      keywords: knowledgeBase.keywords,
      questionVariation: knowledgeBase.questionVariation,
      productId: knowledgeBase.productId,
      produto: productsCatalog.produto,
      subproduto: productsCatalog.subproduto,
    })
    .from(knowledgeBase)
    .leftJoin(productsCatalog, eq(knowledgeBase.productId, productsCatalog.id))
    .leftJoin(knowledgeBaseEmbeddings, eq(knowledgeBase.id, knowledgeBaseEmbeddings.articleId))
    .where(isNull(knowledgeBaseEmbeddings.id));

  console.log(`Found ${articles.length} articles without embeddings`);

  if (articles.length === 0) {
    console.log("No articles to process");
    return;
  }

  const articlesWithProduct: KnowledgeBaseArticleWithProduct[] = articles.map((a) => {
    const productFullName = a.subproduto 
      ? `${a.produto} > ${a.subproduto}` 
      : (a.produto || "Sem produto");
    
    return {
      id: a.id,
      question: a.question,
      answer: a.answer,
      keywords: a.keywords,
      questionVariation: a.questionVariation as string[] | null ?? undefined,
      productFullName,
    };
  });

  const updateFn = async (
    articleId: number,
    embeddingStr: string,
    contentHash: string,
    logId: number,
    tokensUsed: number | null
  ) => {
    await db.insert(knowledgeBaseEmbeddings).values({
      articleId,
      embedding: embeddingStr,
      contentHash,
      openaiLogId: logId,
      tokensUsed,
    });
    console.log(`  Created embedding for article ${articleId}`);
  };

  const result = await batchGenerateEmbeddings(articlesWithProduct, updateFn, {
    batchSize: 10,
    delayMs: 500,
  });

  console.log(`\nCompleted: ${result.processed} articles processed`);
  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    result.errors.forEach((e) => console.log(`  - Article ${e.articleId}: ${e.error}`));
  }
}

regenerateEmbeddings()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
