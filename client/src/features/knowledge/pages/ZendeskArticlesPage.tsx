import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw,
  Search,
  FileText,
  Filter,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "../../../shared/components/ui";
import { ZendeskArticleCard, EmbeddingProgressPanel, SyncStatusBanner } from "../components";
import {
  ZendeskArticle,
  SyncInfo,
  SyncResult,
  EmbeddingProgress,
  Section,
  Subdomain,
  ArticleViewCount,
  SUBDOMAIN_LABELS,
} from "../types";

export function ZendeskArticlesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubdomain, setSelectedSubdomain] = useState("");
  
  const { data: syncInfo } = useQuery<SyncInfo>({
    queryKey: ["/api/zendesk-articles/sync-info"],
  });
  
  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["/api/zendesk-articles/sections"],
  });
  
  const { data: subdomains = [] } = useQuery<Subdomain[]>({
    queryKey: ["/api/zendesk-articles/subdomains"],
  });
  
  const { data: articles = [], isLoading } = useQuery<ZendeskArticle[]>({
    queryKey: ["/api/zendesk-articles", search, selectedSection, selectedSubdomain],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedSection) params.append("sectionId", selectedSection);
      if (selectedSubdomain) params.append("helpCenterSubdomain", selectedSubdomain);
      const res = await fetch(`/api/zendesk-articles?${params}`);
      return res.json();
    },
  });
  
  const { data: statistics = [] } = useQuery<ArticleViewCount[]>({
    queryKey: ["/api/zendesk-articles/statistics"],
    queryFn: async () => {
      const res = await fetch("/api/zendesk-articles/statistics?limit=1000");
      return res.json();
    },
  });
  
  const { data: embeddingProgress } = useQuery<EmbeddingProgress>({
    queryKey: ["/api/zendesk-articles/embeddings/progress"],
    queryFn: async () => {
      const res = await fetch("/api/zendesk-articles/embeddings/progress");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isProcessing ? 3000 : false;
    },
  });
  
  const viewCountMap = (Array.isArray(statistics) ? statistics : []).reduce<Record<number, number>>((acc, stat) => {
    acc[stat.zendeskArticleId] = stat.viewCount;
    return acc;
  }, {});
  
  const syncMutation = useMutation<SyncResult, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/zendesk-articles/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao sincronizar artigos");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zendesk-articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zendesk-articles/sync-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zendesk-articles/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zendesk-articles/subdomains"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zendesk-articles/embeddings/progress"] });
    },
  });
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {syncInfo?.lastSyncAt ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Última sincronização: {format(new Date(syncInfo.lastSyncAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              Nenhuma sincronização realizada
            </span>
          )}
          <span className="text-gray-300">|</span>
          <span>{syncInfo?.articleCount ?? 0} artigos</span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-500" />
            {embeddingProgress?.completed ?? 0} embeddings
          </span>
        </div>
        
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          isLoading={syncMutation.isPending}
          size="sm"
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Sincronizar
        </Button>
      </div>
      
      <SyncStatusBanner
        isSuccess={syncMutation.isSuccess}
        isError={syncMutation.isError}
        data={syncMutation.data}
        errorMessage={syncMutation.error?.message}
      />
      
      <EmbeddingProgressPanel
        progress={embeddingProgress}
        showSuccessMessage={syncMutation.isSuccess}
      />
      
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar artigos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedSubdomain}
            onChange={(e) => setSelectedSubdomain(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            <option value="">Todos os subdomínios</option>
            {subdomains.map((sub) => (
              <option key={sub.subdomain} value={sub.subdomain}>
                {SUBDOMAIN_LABELS[sub.subdomain] || sub.subdomain} ({sub.count})
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            <option value="">Todas as seções</option>
            {sections.map((section) => (
              <option key={section.sectionId} value={section.sectionId}>
                {section.sectionName || section.sectionId} ({section.count})
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Carregando artigos...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhum artigo encontrado</p>
            <p className="text-sm mt-1">Clique em "Sincronizar" para importar artigos do Zendesk</p>
          </div>
        ) : (
          articles.map((article) => (
            <ZendeskArticleCard 
              key={article.id} 
              article={article} 
              viewCount={viewCountMap[article.id] ?? 0} 
            />
          ))
        )}
      </div>
    </div>
  );
}
