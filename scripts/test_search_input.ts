import { generateEmbedding } from "../server/shared/embeddings/embeddingService.js";
import { knowledgeBaseStorage } from "../server/features/ai/storage/knowledgeBaseStorage.js";
import { searchObjectiveProblemsBySimilarity } from "../server/features/knowledge/storage/objectiveProblemsStorage.js";

async function testNewInput() {
  // Novo input simplificado
  const newInput = `Produto: Conta Digital
Solicitação: Cliente relata problemas com login ou senha.
Tipo: Quer suporte`;

  console.log("=== INPUT NOVO (simplificado) ===");
  console.log(newInput);
  console.log("\n=== Gerando embedding... ===\n");

  const { embedding } = await generateEmbedding(newInput, { contextType: "query" });

  console.log("=== BUSCANDO ARTIGOS ===\n");
  const articles = await knowledgeBaseStorage.searchBySimilarity(embedding, { limit: 10 });
  
  console.log("Artigos encontrados:");
  for (const a of articles) {
    console.log(`  - [${a.similarity}%] ${a.question}`);
  }

  console.log("\n=== BUSCANDO PROBLEMAS ===\n");
  const problems = await searchObjectiveProblemsBySimilarity({
    queryEmbedding: embedding,
    onlyActive: true,
    limit: 10
  });
  
  console.log("Problemas encontrados:");
  for (const p of problems) {
    console.log(`  - [${p.similarity}%] ${p.name}`);
  }
  
  console.log("\n=== COMPARAÇÃO COM RESULTADO ATUAL ===");
  console.log("Resultado ATUAL (com JSON inteiro):");
  console.log("  Problemas: login/senha 69%, Dados incorretos 67%, Conta bloqueada 62%, Erro criação 62%, Conta cancelada 58%");
  console.log("  Artigos: Transação negada 53%, Compra recusada 53%, Transação duplicada 53%, etc.");
}

testNewInput().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
