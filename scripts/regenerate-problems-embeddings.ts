import { generateAllMissingEmbeddings } from "../server/features/knowledge/storage/objectiveProblemsStorage.js";

async function main() {
  console.log("Starting objective problems embeddings regeneration...");
  
  const result = await generateAllMissingEmbeddings();
  
  console.log(`\nCompleted: ${result.processed} problems processed`);
  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }
}

main()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
