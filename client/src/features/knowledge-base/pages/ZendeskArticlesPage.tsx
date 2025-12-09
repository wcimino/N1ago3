import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Filter,
  CheckCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react";

interface ZendeskArticle {
  id: number;
  zendeskId: string;
  helpCenterSubdomain: string | null;
  title: string;
  body: string | null;
  sectionId: string | null;
  sectionName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  locale: string | null;
  htmlUrl: string | null;
  draft: boolean;
  promoted: boolean;
  voteSum: number | null;
  voteCount: number | null;
  zendeskCreatedAt: string | null;
  zendeskUpdatedAt: string | null;
  syncedAt: string;
}

const SUBDOMAIN_LABELS: Record<string, string> = {
  movilepay: "MovilePay",
  centralajudaifp: "Central Ajuda",
};

interface SyncInfo {
  lastSyncAt: string | null;
  articleCount: number;
}

interface SyncResult {
  success: boolean;
  articlesTotal: number;
  articlesCreated: number;
  articlesUpdated: number;
  errors: string[];
  syncedAt: string;
}

interface Section {
  sectionId: string;
  sectionName: string | null;
  count: number;
}

interface ArticleViewCount {
  zendeskArticleId: number;
  viewCount: number;
}

function stripHtmlTags(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function ArticleCard({ article, viewCount }: { article: ZendeskArticle; viewCount: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const plainText = stripHtmlTags(article.body);
  const preview = plainText.slice(0, 200) + (plainText.length > 200 ? "..." : "");
  
  return (
    <div className="bg-white border rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-gray-900 truncate">{article.title}</h3>
              {article.helpCenterSubdomain && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  {SUBDOMAIN_LABELS[article.helpCenterSubdomain] || article.helpCenterSubdomain}
                </span>
              )}
              {article.draft && (
                <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                  Rascunho
                </span>
              )}
              {article.promoted && (
                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                  Promovido
                </span>
              )}
            </div>
            
            {article.sectionName && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                {article.categoryName && (
                  <>
                    <span className="text-purple-600">{article.categoryName}</span>
                    <span className="text-gray-300">›</span>
                  </>
                )}
                <span className="text-blue-600">{article.sectionName}</span>
              </div>
            )}
            
            {!isExpanded && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{preview}</p>
            )}
            
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {article.zendeskUpdatedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Atualizado há {formatDistanceToNow(new Date(article.zendeskUpdatedAt), { locale: ptBR })}
                </span>
              )}
              {article.locale && (
                <span className="uppercase">{article.locale}</span>
              )}
              {viewCount > 0 && (
                <span className="flex items-center gap-1 text-purple-600">
                  <BarChart3 className="w-3 h-3" />
                  {viewCount} {viewCount === 1 ? "consulta" : "consultas"}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {article.htmlUrl && (
              <a
                href={article.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Abrir no Zendesk"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button className="p-1.5 text-gray-400 hover:text-gray-600">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          <div
            className="prose prose-sm max-w-none mt-3 text-gray-700"
            dangerouslySetInnerHTML={{ __html: article.body || "" }}
          />
        </div>
      )}
    </div>
  );
}

export function ZendeskArticlesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  
  const { data: syncInfo } = useQuery<SyncInfo>({
    queryKey: ["/api/zendesk-articles/sync-info"],
  });
  
  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["/api/zendesk-articles/sections"],
  });
  
  const { data: articles = [], isLoading } = useQuery<ZendeskArticle[]>({
    queryKey: ["/api/zendesk-articles", search, selectedSection],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedSection) params.append("sectionId", selectedSection);
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
        </div>
        
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>
      
      {syncMutation.isSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle className="w-4 h-4" />
            Sincronização concluída
          </div>
          <div className="mt-1 text-green-600">
            {syncMutation.data.articlesCreated} novos, {syncMutation.data.articlesUpdated} atualizados
            ({syncMutation.data.articlesTotal} total)
          </div>
        </div>
      )}
      
      {syncMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-red-700 font-medium">
            <AlertCircle className="w-4 h-4" />
            Erro ao sincronizar artigos
          </div>
          <div className="mt-1 text-red-600">
            {syncMutation.error?.message || "Verifique as credenciais do Zendesk."}
          </div>
        </div>
      )}
      
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
            <ArticleCard 
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
