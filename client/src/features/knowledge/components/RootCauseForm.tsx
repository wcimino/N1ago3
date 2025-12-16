import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Puzzle, ChevronDown, ChevronUp, HelpCircle, Plus, X } from "lucide-react";
import { FormField } from "../../../shared/components/crud";
import { FormActions } from "../../../shared/components/ui";

interface ValidationQuestion {
  question: string;
  order: number;
}

interface KnowledgeBaseObjectiveProblem {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

interface KnowledgeBaseSolution {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ProblemWithQuestions {
  problemId: number;
  validationQuestions: ValidationQuestion[];
}

export interface RootCauseFormData {
  name: string;
  description: string;
  isActive: boolean;
  problems: ProblemWithQuestions[];
  solutionIds: number[];
}

export const emptyRootCauseForm: RootCauseFormData = {
  name: "",
  description: "",
  isActive: true,
  problems: [],
  solutionIds: [],
};

interface RootCauseFormProps {
  formData: RootCauseFormData;
  setFormData: React.Dispatch<React.SetStateAction<RootCauseFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
  isMutating: boolean;
}

export function RootCauseForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEditing,
  isMutating,
}: RootCauseFormProps) {
  const [expandedProblemId, setExpandedProblemId] = useState<number | null>(null);
  const [newQuestionByProblem, setNewQuestionByProblem] = useState<Record<number, string>>({});

  const { data: allProblems = [] } = useQuery<KnowledgeBaseObjectiveProblem[]>({
    queryKey: ["/api/knowledge/objective-problems"],
  });

  const { data: allSolutions = [] } = useQuery<KnowledgeBaseSolution[]>({
    queryKey: ["/api/knowledge/solutions"],
  });

  const toggleProblem = (problemId: number) => {
    const existing = formData.problems.find(p => p.problemId === problemId);
    if (existing) {
      setFormData(prev => ({
        ...prev,
        problems: prev.problems.filter(p => p.problemId !== problemId),
      }));
      if (expandedProblemId === problemId) {
        setExpandedProblemId(null);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        problems: [...prev.problems, { problemId, validationQuestions: [] }],
      }));
    }
  };

  const toggleSolution = (solutionId: number) => {
    setFormData(prev => ({
      ...prev,
      solutionIds: prev.solutionIds.includes(solutionId)
        ? prev.solutionIds.filter(id => id !== solutionId)
        : [...prev.solutionIds, solutionId],
    }));
  };

  const addQuestion = (problemId: number) => {
    const questionText = newQuestionByProblem[problemId] || "";
    if (!questionText.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.map(p => {
        if (p.problemId === problemId) {
          return {
            ...p,
            validationQuestions: [
              ...p.validationQuestions,
              { question: questionText.trim(), order: p.validationQuestions.length + 1 },
            ],
          };
        }
        return p;
      }),
    }));
    setNewQuestionByProblem(prev => ({ ...prev, [problemId]: "" }));
  };

  const removeQuestion = (problemId: number, questionIndex: number) => {
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.map(p => {
        if (p.problemId === problemId) {
          const newQuestions = p.validationQuestions
            .filter((_, i) => i !== questionIndex)
            .map((q, i) => ({ ...q, order: i + 1 }));
          return { ...p, validationQuestions: newQuestions };
        }
        return p;
      }),
    }));
  };

  const activeProblems = useMemo(() => allProblems.filter(p => p.isActive), [allProblems]);
  const activeSolutions = useMemo(() => allSolutions.filter(s => s.isActive), [allSolutions]);
  const selectedProblemIds = useMemo(() => new Set(formData.problems.map(p => p.problemId)), [formData.problems]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isEditing ? "Editar Causa-raiz" : "Nova Causa-raiz"}
        </h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          type="text"
          label="Nome"
          required
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Nome da causa-raiz..."
        />

        <FormField
          type="textarea"
          label="Descricao"
          required
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Descricao detalhada da causa-raiz..."
          rows={3}
        />

        <FormField
          type="checkbox"
          label="Ativo"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Problemas Relacionados ({formData.problems.length})
            </label>
            <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              {activeProblems.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  Nenhum problema disponível
                </div>
              ) : (
                activeProblems.map(problem => {
                  const isSelected = selectedProblemIds.has(problem.id);
                  const problemData = formData.problems.find(p => p.problemId === problem.id);
                  const isExpanded = expandedProblemId === problem.id;
                  const questionCount = problemData?.validationQuestions.length || 0;
                  
                  return (
                    <div key={problem.id} className="border-b last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProblem(problem.id)}
                          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700 flex-1 truncate">{problem.name}</span>
                        {isSelected && (
                          <>
                            {questionCount > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-violet-100 text-violet-700 rounded">
                                {questionCount} perguntas
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedProblemId(isExpanded ? null : problem.id)}
                              className="p-1 text-gray-400 hover:text-violet-600"
                              title="Perguntas de validação"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                      </div>
                      
                      {isSelected && isExpanded && problemData && (
                        <div className="px-3 pb-3 bg-gray-50 border-t">
                          <div className="pt-2 space-y-2">
                            <div className="text-xs font-medium text-gray-600 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              Perguntas de Validação
                            </div>
                            
                            {problemData.validationQuestions.map((q, idx) => (
                              <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded border">
                                <span className="text-xs text-gray-400 mt-0.5">{idx + 1}.</span>
                                <span className="flex-1 text-sm text-gray-700">{q.question}</span>
                                <button
                                  type="button"
                                  onClick={() => removeQuestion(problem.id, idx)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newQuestionByProblem[problem.id] || ""}
                                onChange={(e) => setNewQuestionByProblem(prev => ({ ...prev, [problem.id]: e.target.value }))}
                                placeholder="Nova pergunta..."
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-violet-500"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addQuestion(problem.id);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => addQuestion(problem.id)}
                                className="px-2 py-1 text-sm bg-violet-100 text-violet-700 rounded hover:bg-violet-200"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Puzzle className="w-4 h-4 inline mr-1" />
              Soluções Relacionadas ({formData.solutionIds.length})
            </label>
            <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              {activeSolutions.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  Nenhuma solução disponível
                </div>
              ) : (
                activeSolutions.map(solution => (
                  <label
                    key={solution.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={formData.solutionIds.includes(solution.id)}
                      onChange={() => toggleSolution(solution.id)}
                      className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                    />
                    <span className="text-sm text-gray-700 truncate">{solution.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <FormActions
          isLoading={isMutating}
          isEditing={isEditing}
          onCancel={onCancel}
          className="pt-4 border-t"
        />
      </form>
    </div>
  );
}
