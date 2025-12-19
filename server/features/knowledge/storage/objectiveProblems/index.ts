export type {
  ObjectiveProblemWithProducts,
  ProblemWithProductNames,
  SearchObjectiveProblemsParams,
  ObjectiveProblemSearchResult,
  SemanticSearchParams,
  SemanticSearchResult,
  ObjectiveProblemStats,
} from "./types.js";

export {
  getAllObjectiveProblems,
  getActiveObjectiveProblems,
  getObjectiveProblemById,
  createObjectiveProblem,
  updateObjectiveProblem,
  deleteObjectiveProblem,
} from "./crud.js";

export {
  getProductIdsForProblem,
  getProductIdsForProblems,
  setProductsForProblem,
  getProductNamesForProblem,
  getAllProducts,
} from "./products.js";

export {
  generateAndSaveEmbeddingAsync,
  hasObjectiveProblemEmbeddings,
  getObjectiveProblemStats,
  getProblemsWithoutEmbeddings,
  generateAllMissingEmbeddings,
} from "./embedding.js";

export {
  searchObjectiveProblems,
  searchObjectiveProblemsBySimilarity,
} from "./search.js";
