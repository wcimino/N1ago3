import { X } from "lucide-react";
import { KnowledgeBaseForm } from "./KnowledgeBaseForm";
import type { KnowledgeBaseArticle, KnowledgeBaseFormData } from "../hooks";

interface PrefilledArticleData {
  productId: number;
  subjectId: number;
  intentId: number;
  subjectName: string;
  intentName: string;
  productName: string;
}

interface ArticleFormSectionProps {
  editingArticle: KnowledgeBaseArticle | null;
  prefilledData: PrefilledArticleData | null;
  onSubmit: (data: KnowledgeBaseFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function ArticleFormSection({
  editingArticle,
  prefilledData,
  onSubmit,
  onCancel,
  isLoading,
}: ArticleFormSectionProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">
          {editingArticle ? "Editar Artigo" : "Novo Artigo"}
        </h3>
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <KnowledgeBaseForm
        initialData={editingArticle}
        prefilledData={prefilledData}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={isLoading}
      />
    </div>
  );
}

export type { PrefilledArticleData };
