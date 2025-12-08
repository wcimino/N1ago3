import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, X, ChevronDown } from "lucide-react";

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

  const selectClass = "w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white";
  const inputClass = "w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const textareaClass = "w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Nome do Artigo</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={inputClass}
          placeholder="Ex: Como contratar o Cartão de Crédito"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={labelClass}>Produto *</label>
          <div className="relative">
            <select name="productStandard" value={formData.productStandard} onChange={handleChange} className={selectClass} required>
              <option value="">Selecione</option>
              {produtos.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Subproduto</label>
          <div className="relative">
            <select name="subproductStandard" value={formData.subproductStandard} onChange={handleChange} className={selectClass} disabled={!formData.productStandard || subprodutos.length === 0}>
              <option value="">{subprodutos.length === 0 ? '-' : 'Selecione'}</option>
              {subprodutos.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Categoria 1</label>
          <div className="relative">
            <select name="category1" value={formData.category1} onChange={handleChange} className={selectClass} disabled={!formData.productStandard || categorias1.length === 0}>
              <option value="">{categorias1.length === 0 ? '-' : 'Selecione'}</option>
              {categorias1.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Categoria 2</label>
          <div className="relative">
            <select name="category2" value={formData.category2} onChange={handleChange} className={selectClass} disabled={!formData.productStandard || categorias2.length === 0}>
              <option value="">{categorias2.length === 0 ? '-' : 'Selecione'}</option>
              {categorias2.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Intenção *</label>
        <input type="text" name="intent" value={formData.intent} onChange={handleChange} className={inputClass} placeholder="Ex: Dúvida, Solicitação, Reclamação..." required />
      </div>

      <div>
        <label className={labelClass}>Descrição do Problema *</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className={textareaClass} placeholder="Descreva a situação ou problema..." required />
      </div>

      <div className="bg-green-50 rounded p-2 border border-green-100">
        <label className={labelClass}>Resolução *</label>
        <textarea name="resolution" value={formData.resolution} onChange={handleChange} rows={3} className={`${textareaClass} bg-white`} placeholder="Descreva a solução..." required />
      </div>

      <div>
        <label className={`${labelClass} text-gray-400`}>Observações</label>
        <textarea name="observations" value={formData.observations} onChange={handleChange} rows={1} className={`${textareaClass} bg-gray-50`} placeholder="Opcional..." />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button type="submit" disabled={!isValid || isLoading} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {isLoading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
