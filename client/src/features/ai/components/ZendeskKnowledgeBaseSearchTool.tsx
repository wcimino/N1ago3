import { useState, useEffect } from "react";
import { FileText, HelpCircle, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ExpandableSearchTool } from "../../../shared/components/ui";

interface ZendeskArticle {
  id: number;
  articleId: string;
  title: string;
  sectionName: string | null;
  body: string | null;
  htmlUrl: string | null;
}

interface ZendeskSubdomain {
  subdomain: string;
  count: number;
}

interface ZendeskKnowledgeBaseSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ZendeskKnowledgeBaseSearchTool({ isExpanded, onToggle }: ZendeskKnowledgeBaseSearchToolProps) {
  const [keywords, setKeywords] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [selectedSubdomains, setSelectedSubdomains] = useState<string[]>([]);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const { data: subdomains } = useQuery<ZendeskSubdomain[]>({
    queryKey: ["zendesk-subdomains"],
    queryFn: async () => {
      const res = await fetch("/api/zendesk-articles/subdomains", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar subdomínios");
      return res.json();
    },
    enabled: isExpanded,
  });

  useEffect(() => {
    if (subdomains && subdomains.length > 0 && selectedSubdomains.length === 0) {
      setSelectedSubdomains(subdomains.map(s => s.subdomain));
    }
  }, [subdomains]);

  const { data: sections } = useQuery<Array<{ sectionId: string; sectionName: string }>>({
    queryKey: ["zendesk-sections"],
    queryFn: async () => {
      const res = await fetch("/api/zendesk-articles/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar seções");
      return res.json();
    },
    enabled: isExpanded,
  });

  const noSubdomainsSelected = subdomains && subdomains.length > 0 && selectedSubdomains.length === 0;

  const { data, isLoading, error } = useQuery<ZendeskArticle[]>({
    queryKey: ["zendesk-search", keywords, sectionId, selectedSubdomains, searchTrigger],
    queryFn: async () => {
      if (noSubdomainsSelected) {
        return [];
      }
      const params = new URLSearchParams();
      params.set("limit", "10");
      if (keywords) params.set("search", keywords);
      if (sectionId) params.set("sectionId", sectionId);
      if (selectedSubdomains.length > 0) {
        params.set("helpCenterSubdomains", selectedSubdomains.join(","));
      }
      
      const res = await fetch(`/api/zendesk-articles?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha na busca");
      return res.json();
    },
    enabled: searchTrigger > 0 && isExpanded && !noSubdomainsSelected,
  });

  const handleSubdomainToggle = (subdomain: string) => {
    setSelectedSubdomains(prev => {
      if (prev.includes(subdomain)) {
        return prev.filter(s => s !== subdomain);
      }
      return [...prev, subdomain];
    });
  };

  const handleSearch = () => {
    setSearchTrigger(prev => prev + 1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <ExpandableSearchTool
      title="search_knowledge_base_zendesk"
      description="Busca artigos no Help Center do Zendesk por palavras-chave e seção"
      icon={<HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />}
      iconBgColor="bg-orange-100"
      accentColor="orange"
      isExpanded={isExpanded}
      onToggle={onToggle}
      isLoading={isLoading}
      onSearch={handleSearch}
      error={error as Error | null}
      helpText="Busca artigos públicos do Help Center do Zendesk. Útil para encontrar FAQs e documentação oficial."
      resultsCount={data?.length}
      resultsLabel="artigos"
      emptyMessage="Nenhum artigo encontrado"
      results={data && (
        <>
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
        </>
      )}
    >
      <div className="grid gap-3">
        {subdomains && subdomains.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subdomínios</label>
            <div className="flex flex-wrap gap-3">
              {subdomains.map((subdomain) => (
                <label key={subdomain.subdomain} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSubdomains.includes(subdomain.subdomain)}
                    onChange={() => handleSubdomainToggle(subdomain.subdomain)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    {subdomain.subdomain}
                    <span className="text-gray-400 ml-1">({subdomain.count})</span>
                  </span>
                </label>
              ))}
            </div>
            {noSubdomainsSelected && (
              <p className="text-sm text-amber-600 mt-2">Selecione pelo menos um subdomínio para realizar a busca.</p>
            )}
          </div>
        )}

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
    </ExpandableSearchTool>
  );
}
