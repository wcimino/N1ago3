import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, X, ChevronDown, Package, Tag, FileText, MessageSquare, Lightbulb } from "lucide-react";

interface KnowledgeBaseArticle {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  category1: string | null;
  category2: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseFormData {
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  category1: string | null;
  category2: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
}

interface KnowledgeBaseFormProps {
  initialData?: KnowledgeBaseArticle | null;
  onSubmit: (data: KnowledgeBaseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function KnowledgeBaseForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: KnowledgeBaseFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    productStandard: "",
    subproductStandard: "",
    category1: "",
    category2: "",
    intent: "",
    description: "",
    resolution: "",
    observations: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        productStandard: initialData.productStandard,
        subproductStandard: initialData.subproductStandard || "",
        category1: initialData.category1 || "",
        category2: initialData.category2 || "",
        intent: initialData.intent,
        description: initialData.description,
        resolution: initialData.resolution,
        observations: initialData.observations || "",
      });
    }
  }, [initialData]);

  const { data: produtos = [] } = useQuery<string[]>({
    queryKey: ["/api/ifood-products/distinct/produtos"],
  });

  const { data: subprodutos = [] } = useQuery<string[]>({
    queryKey: ["/api/ifood-products/distinct/subprodutos", formData.productStandard],
    queryFn: async () => {
      if (!formData.productStandard) return [];
      const res = await fetch(`/api/ifood-products/distinct/subprodutos?produto=${encodeURIComponent(formData.productStandard)}`);
      return res.json();
    },
    enabled: !!formData.productStandard,
  });

  const { data: categorias1 = [] } = useQuery<string[]>({
    queryKey: ["/api/ifood-products/distinct/categoria1", formData.productStandard, formData.subproductStandard],
    queryFn: async () => {
      if (!formData.productStandard) return [];
      const params = new URLSearchParams({ produto: formData.productStandard });
      if (formData.subproductStandard) params.append("subproduto", formData.subproductStandard);
      const res = await fetch(`/api/ifood-products/distinct/categoria1?${params}`);
      return res.json();
    },
    enabled: !!formData.productStandard,
  });

  const { data: categorias2 = [] } = useQuery<string[]>({
    queryKey: ["/api/ifood-products/distinct/categoria2", formData.productStandard, formData.subproductStandard, formData.category1],
    queryFn: async () => {
      if (!formData.productStandard) return [];
      const params = new URLSearchParams({ produto: formData.productStandard });
      if (formData.subproductStandard) params.append("subproduto", formData.subproductStandard);
      if (formData.category1) params.append("categoria1", formData.category1);
      const res = await fetch(`/api/ifood-products/distinct/categoria2?${params}`);
      return res.json();
    },
    enabled: !!formData.productStandard,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === "productStandard") {
      setFormData((prev) => ({
        ...prev,
        productStandard: value,
        subproductStandard: "",
        category1: "",
        category2: "",
      }));
    } else if (name === "subproductStandard") {
      setFormData((prev) => ({
        ...prev,
        subproductStandard: value,
        category1: "",
        category2: "",
      }));
    } else if (name === "category1") {
      setFormData((prev) => ({
        ...prev,
        category1: value,
        category2: "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name || null,
      productStandard: formData.productStandard,
      subproductStandard: formData.subproductStandard || null,
      category1: formData.category1 || null,
      category2: formData.category2 || null,
      intent: formData.intent,
      description: formData.description,
      resolution: formData.resolution,
      observations: formData.observations || null,
    });
  };

  const isValid =
    formData.productStandard.trim() &&
    formData.intent.trim() &&
    formData.description.trim() &&
    formData.resolution.trim();

  const selectClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white text-sm transition-all";
  const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all";
  const textareaClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all resize-none";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <label className={labelClass}>
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Nome do Artigo
          </span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`${inputClass} bg-white`}
          placeholder="Ex: Como contratar o Cartão de Crédito"
        />
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Classificação do Produto</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              Produto <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                name="productStandard"
                value={formData.productStandard}
                onChange={handleChange}
                className={selectClass}
                required
              >
                <option value="">Selecione</option>
                {produtos.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Subproduto</label>
            <div className="relative">
              <select
                name="subproductStandard"
                value={formData.subproductStandard}
                onChange={handleChange}
                className={`${selectClass} ${!formData.productStandard || subprodutos.length === 0 ? 'bg-gray-50 text-gray-400' : ''}`}
                disabled={!formData.productStandard || subprodutos.length === 0}
              >
                <option value="">{subprodutos.length === 0 ? 'Nenhum disponível' : 'Selecione'}</option>
                {subprodutos.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Categoria 1</label>
            <div className="relative">
              <select
                name="category1"
                value={formData.category1}
                onChange={handleChange}
                className={`${selectClass} ${!formData.productStandard || categorias1.length === 0 ? 'bg-gray-50 text-gray-400' : ''}`}
                disabled={!formData.productStandard || categorias1.length === 0}
              >
                <option value="">{categorias1.length === 0 ? 'Nenhuma disponível' : 'Selecione'}</option>
                {categorias1.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Categoria 2</label>
            <div className="relative">
              <select
                name="category2"
                value={formData.category2}
                onChange={handleChange}
                className={`${selectClass} ${!formData.productStandard || categorias2.length === 0 ? 'bg-gray-50 text-gray-400' : ''}`}
                disabled={!formData.productStandard || categorias2.length === 0}
              >
                <option value="">{categorias2.length === 0 ? 'Nenhuma disponível' : 'Selecione'}</option>
                {categorias2.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>
          <span className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-600" />
            Intenção <span className="text-red-500">*</span>
          </span>
        </label>
        <input
          type="text"
          name="intent"
          value={formData.intent}
          onChange={handleChange}
          className={inputClass}
          placeholder="Ex: Dúvida, Solicitação, Reclamação..."
          required
        />
      </div>

      <div>
        <label className={labelClass}>
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-600" />
            Descrição do Problema <span className="text-red-500">*</span>
          </span>
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className={textareaClass}
          placeholder="Descreva a situação ou problema que o cliente apresenta..."
          required
        />
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
        <label className={labelClass}>
          <span className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-green-600" />
            Resolução <span className="text-red-500">*</span>
          </span>
        </label>
        <textarea
          name="resolution"
          value={formData.resolution}
          onChange={handleChange}
          rows={5}
          className={`${textareaClass} bg-white`}
          placeholder="Descreva a solução ou procedimento para resolver o problema. Use verbos no infinitivo (Orientar, Verificar, Solicitar...)"
          required
        />
      </div>

      <div>
        <label className={labelClass}>
          <span className="text-gray-500">Observações (opcional)</span>
        </label>
        <textarea
          name="observations"
          value={formData.observations}
          onChange={handleChange}
          rows={2}
          className={`${textareaClass} bg-gray-50`}
          placeholder="Observações adicionais, exceções, casos especiais..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
        >
          <Save className="w-4 h-4" />
          {isLoading ? "Salvando..." : "Salvar Artigo"}
        </button>
      </div>
    </form>
  );
}
