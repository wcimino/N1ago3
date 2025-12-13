import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, AlertTriangle } from "lucide-react";
import { useReportData, PeriodFilter } from "../hooks/useReportData";
import { PeriodFilter as PeriodFilterComponent } from "../components/PeriodFilter";
import { ReportTable, Column } from "../components/ReportTable";
import { HierarchicalReportTable } from "../components/HierarchicalReportTable";
import { SegmentedTabs } from "../../../shared/components/ui/SegmentedTabs";
import { fetchApi } from "../../../lib/queryClient";

interface SubproductNode {
  subproduct: string;
  count: number;
}

interface ProductNode {
  product: string;
  count: number;
  subproducts: SubproductNode[];
}

interface ProblemNode {
  problem: string;
  count: number;
  products: ProductNode[];
}

interface HierarchicalProblemData {
  problems: ProblemNode[];
  total: number;
}

interface CustomerConversationCount {
  customerName: string;
  conversationCount: number;
}

type ReportTab = "product-problem" | "customer-conversations";

const tabs = [
  { id: "product-problem", label: "Problemas", icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "customer-conversations", label: "Conversas por Cliente", icon: <Users className="w-4 h-4" /> },
];

const customerConversationColumns: Column<CustomerConversationCount>[] = [
  { key: "customerName", header: "Cliente" },
  { 
    key: "conversationCount", 
    header: "Conversas", 
    align: "right",
    render: (value: number) => value.toLocaleString("pt-BR"),
  },
];

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("product-problem");
  const [period, setPeriod] = useState<PeriodFilter>("24h");

  const hierarchicalProblemQuery = useQuery<HierarchicalProblemData>({
    queryKey: ["problem-hierarchy", period],
    queryFn: () => fetchApi<HierarchicalProblemData>(`/api/reports/problem-hierarchy?period=${period}`),
  });

  const customerConversationQuery = useReportData<CustomerConversationCount>({
    endpoint: "/api/reports/customer-conversation-counts",
    period,
    queryKey: "customer-conversation-counts",
    limit: 10,
  });

  const handleRefresh = () => {
    if (activeTab === "product-problem") {
      hierarchicalProblemQuery.refetch();
    } else {
      customerConversationQuery.refetch();
    }
  };

  const isFetching = activeTab === "product-problem" 
    ? hierarchicalProblemQuery.isFetching 
    : customerConversationQuery.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-500">Análise de atendimentos</p>
          </div>
        </div>
        <PeriodFilterComponent
          value={period}
          onChange={setPeriod}
          onRefresh={handleRefresh}
          isRefreshing={isFetching}
        />
      </div>

      <SegmentedTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as ReportTab)}
      />

      {activeTab === "product-problem" && (
        <HierarchicalReportTable
          title="Contagem por Problema"
          data={hierarchicalProblemQuery.data?.problems ?? []}
          total={hierarchicalProblemQuery.data?.total ?? 0}
          isLoading={hierarchicalProblemQuery.isLoading}
          isError={hierarchicalProblemQuery.isError}
          error={hierarchicalProblemQuery.error}
          onRetry={() => hierarchicalProblemQuery.refetch()}
        />
      )}

      {activeTab === "customer-conversations" && (
        <ReportTable<CustomerConversationCount>
          title="Conversas por Cliente"
          columns={customerConversationColumns}
          data={customerConversationQuery.data}
          isLoading={customerConversationQuery.isLoading}
          isError={customerConversationQuery.isError}
          error={customerConversationQuery.error}
          onRetry={() => customerConversationQuery.refetch()}
          page={customerConversationQuery.page}
          totalPages={customerConversationQuery.totalPages}
          total={customerConversationQuery.total}
          showingFrom={customerConversationQuery.showingFrom}
          showingTo={customerConversationQuery.showingTo}
          onPreviousPage={customerConversationQuery.previousPage}
          onNextPage={customerConversationQuery.nextPage}
          hasPreviousPage={customerConversationQuery.hasPreviousPage}
          hasNextPage={customerConversationQuery.hasNextPage}
        />
      )}
    </div>
  );
}
