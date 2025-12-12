import type { KnowledgeBaseObjectiveProblem } from "../../../../shared/schema.js";
import type { EmbeddableArticle } from "../types.js";
import { generateContentHashFromParts } from "../types.js";

export class ObjectiveProblemEmbeddableArticle implements EmbeddableArticle {
  id: number;
  private problem: KnowledgeBaseObjectiveProblem;

  constructor(problem: KnowledgeBaseObjectiveProblem) {
    this.id = problem.id;
    this.problem = problem;
  }

  getContentForEmbedding(): string {
    const parts: string[] = [];
    
    parts.push(`Problema: ${this.problem.name}`);
    parts.push(`Descrição: ${this.problem.description}`);
    
    const synonyms = this.problem.synonyms || [];
    if (synonyms.length > 0) {
      parts.push(`Sinônimos: ${synonyms.join(", ")}`);
    }
    
    const examples = this.problem.examples || [];
    if (examples.length > 0) {
      parts.push(`Exemplos: ${examples.join("; ")}`);
    }

    return parts.join("\n\n");
  }

  getContentHash(): string {
    const synonyms = this.problem.synonyms || [];
    const examples = this.problem.examples || [];
    
    return generateContentHashFromParts([
      this.problem.name,
      this.problem.description,
      synonyms.join(","),
      examples.join(","),
    ]);
  }

  static fromProblem(problem: KnowledgeBaseObjectiveProblem): ObjectiveProblemEmbeddableArticle {
    return new ObjectiveProblemEmbeddableArticle(problem);
  }

  static fromProblems(problems: KnowledgeBaseObjectiveProblem[]): ObjectiveProblemEmbeddableArticle[] {
    return problems.map(p => new ObjectiveProblemEmbeddableArticle(p));
  }
}

export function generateProblemContentHash(problem: {
  name: string;
  description: string;
  synonyms?: string[] | null;
  examples?: string[] | null;
}): string {
  const synonyms = problem.synonyms || [];
  const examples = problem.examples || [];
  
  return generateContentHashFromParts([
    problem.name,
    problem.description,
    synonyms.join(","),
    examples.join(","),
  ]);
}

export function generateProblemContentForEmbedding(problem: {
  name: string;
  description: string;
  synonyms?: string[] | null;
  examples?: string[] | null;
}): string {
  const parts: string[] = [];
  
  parts.push(`Problema: ${problem.name}`);
  parts.push(`Descrição: ${problem.description}`);
  
  const synonyms = problem.synonyms || [];
  if (synonyms.length > 0) {
    parts.push(`Sinônimos: ${synonyms.join(", ")}`);
  }
  
  const examples = problem.examples || [];
  if (examples.length > 0) {
    parts.push(`Exemplos: ${examples.join("; ")}`);
  }

  return parts.join("\n\n");
}
