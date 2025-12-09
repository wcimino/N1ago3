import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tags, ChevronRight, ChevronDown, Plus, Loader2 } from "lucide-react";

interface ProductCatalogItem {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
  parentId: number | null;
}

interface KnowledgeSubject {
  id: number;
  productCatalogId: number;
  name: string;
  synonyms: string[];
  productName?: string | null;
}

interface KnowledgeIntent {
  id: number;
  subjectId: number;
  name: string;
  synonyms: string[];
  subjectName?: string | null;
}

interface ProductNode {
  id: number;
  name: string;
  fullPath: string;
  children: ProductNode[];
  subjects: KnowledgeSubject[];
}

function buildProductTree(products: ProductCatalogItem[], subjects: KnowledgeSubject[]): ProductNode[] {
  const productMap = new Map<string, ProductNode>();
  
  const sortedProducts = [...products].sort((a, b) => {
    const aDepth = [a.produto, a.subproduto, a.categoria1, a.categoria2].filter(Boolean).length;
    const bDepth = [b.produto, b.subproduto, b.categoria1, b.categoria2].filter(Boolean).length;
    return aDepth - bDepth;
  });
  
  for (const p of sortedProducts) {
    const node: ProductNode = {
      id: p.id,
      name: p.categoria2 || p.categoria1 || p.subproduto || p.produto,
      fullPath: p.fullName,
      children: [],
      subjects: subjects.filter(s => s.productCatalogId === p.id),
    };
    
    productMap.set(p.fullName, node);
    
    if (p.parentId) {
      const parent = [...productMap.values()].find(n => 
        products.find(prod => prod.id === p.parentId)?.fullName === n.fullPath
      );
      if (parent) {
        parent.children.push(node);
      }
    }
  }
  
  return [...productMap.values()].filter(node => {
    const product = products.find(p => p.fullName === node.fullPath);
    return product && !product.parentId;
  });
}

export function SubjectsIntentsPage() {
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductCatalogItem[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<KnowledgeSubject[]>({
    queryKey: ["/api/knowledge/subjects", { withProduct: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/subjects?withProduct=true");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
  });

  const { data: intents = [], isLoading: intentsLoading } = useQuery<KnowledgeIntent[]>({
    queryKey: ["/api/knowledge/intents", { withSubject: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/intents?withSubject=true");
      if (!res.ok) throw new Error("Failed to fetch intents");
      return res.json();
    },
  });

  const isLoading = productsLoading || subjectsLoading || intentsLoading;
  const productTree = buildProductTree(products, subjects);

  const toggleProduct = (id: number) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubject = (id: number) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getIntentsForSubject = (subjectId: number) => {
    return intents.filter(i => i.subjectId === subjectId);
  };

  const renderProductNode = (node: ProductNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedProducts.has(node.id);
    const hasChildren = node.children.length > 0 || node.subjects.length > 0;
    const paddingLeft = depth * 20;

    return (
      <div key={node.id}>
        <div 
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => toggleProduct(node.id)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <span className="w-4" />
          )}
          <span className="font-medium text-gray-700">{node.name}</span>
          <span className="text-xs text-gray-400 ml-2">
            {node.subjects.length} assuntos
          </span>
        </div>
        
        {isExpanded && (
          <>
            {node.children.map(child => renderProductNode(child, depth + 1))}
            
            {node.subjects.map(subject => {
              const subjectIntents = getIntentsForSubject(subject.id);
              const isSubjectExpanded = expandedSubjects.has(subject.id);
              
              return (
                <div key={`subject-${subject.id}`}>
                  <div 
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-blue-50 rounded cursor-pointer"
                    style={{ paddingLeft: `${paddingLeft + 20}px` }}
                    onClick={() => toggleSubject(subject.id)}
                  >
                    {subjectIntents.length > 0 ? (
                      isSubjectExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-blue-400" />
                    ) : (
                      <span className="w-4" />
                    )}
                    <Tags className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-700">{subject.name}</span>
                    {subject.synonyms.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({subject.synonyms.length} sinônimos)
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {subjectIntents.length} intenções
                    </span>
                  </div>
                  
                  {isSubjectExpanded && subjectIntents.map(intent => (
                    <div 
                      key={`intent-${intent.id}`}
                      className="flex items-center gap-2 py-1.5 px-2 hover:bg-green-50 rounded"
                      style={{ paddingLeft: `${paddingLeft + 40}px` }}
                    >
                      <span className="w-4" />
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-green-700">{intent.name}</span>
                      {intent.synonyms.length > 0 && (
                        <span className="text-xs text-gray-400">
                          ({intent.synonyms.length} sinônimos)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Gerencie os assuntos e intenções associados aos produtos.
        </p>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Novo Assunto
        </button>
      </div>

      {productTree.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Tags className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Cadastre produtos em Configurações &gt; Cadastro &gt; Produtos</p>
        </div>
      ) : (
        <div className="border rounded-lg p-3 max-h-[500px] overflow-y-auto">
          {productTree.map(node => renderProductNode(node))}
        </div>
      )}
    </div>
  );
}
