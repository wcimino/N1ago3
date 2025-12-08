import { useState } from "react";
import { Search, FileText, HelpCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ZendeskArticle {
  id: number;
  articleId: string;
  title: string;
  sectionName: string | null;
  body: string | null;
  htmlUrl: string | null;
}

interface ZendeskKnowledgeBaseSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ZendeskKnowledgeBaseSearchTool({ isExpanded, onToggle }: ZendeskKnowledgeBaseSearchToolProps) {
  const [keywords, setKeywords] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const { data: sections } = useQuery<Array<{ sectionId: string; sectionName: string }>>({
    queryKey: ["zendesk-sections"],
    queryFn: async () => {
      const res = await fetch("/api/zendesk-articles/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar seções");
      return res.json();
    },
    enabled: isExpanded,
  });

  const { data, isLoading, error } = useQuery<ZendeskArticle[]>({
    queryKey: ["zendesk-search", keywords, sectionId, searchTrigger],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "10");
      if (keywords) params.set("search", keywords);
      if (sectionId) params.set("sectionId", sectionId);
      
      const res = await fetch(`/api/zendesk-articles?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha na busca");
      return res.json();
    },
    enabled: searchTrigger > 0 && isExpanded,
  });

  const handleSearch = () => {
    setSearchTrigger(prev => prev + 1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 sm:p-6 flex items-center gap-4 hover:bg-gray-100 transition-colors"
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">search_knowledge_base_zendesk</h3>
          <p className="text-sm text-gray-600">Busca artigos no Help Center do Zendesk por palavras-chave e seção</p>
        </div>
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t bg-white p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Busca artigos públicos do Help Center do Zendesk. Útil para encontrar FAQs e documentação oficial.
          </p>

          <div className="grid gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Palavras-chave</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ex: como fazer pix, limite de crédito"
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seção (opcional)</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todas as seções</option>
                {sections?.map((section) => (
                  <option key={section.sectionId} value={section.sectionId}>
                    {section.sectionName || section.sectionId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isLoading ? "Buscando..." : "Buscar"}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">Erro ao buscar: {(error as Error).message}</p>
            </div>
          )}

          {data && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900">
                  Resultados ({data.length} {data.length === 1 ? "artigo" : "artigos"})
                </h4>
              </div>

              {data.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhum artigo encontrado</p>
                </div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {data.map((article) => (
                    <div key={article.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 shrink-0">
                            {article.sectionName || "Sem seção"}
                          </span>
                        </div>
                        {article.htmlUrl && (
                          <a
                            href={article.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:text-orange-800 shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      <h5 className="text-sm font-medium text-gray-900 line-clamp-1">{article.title}</h5>
                      {article.body && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                          {article.body.replace(/<[^>]*>/g, '').substring(0, 200)}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
