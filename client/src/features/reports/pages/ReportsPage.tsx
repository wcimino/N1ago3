import { useState } from "react";
import { BarChart3, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { useReportData, PeriodFilter } from "../hooks/useReportData";
import { PeriodFilter as PeriodFilterComponent } from "../components/PeriodFilter";
import { ReportTable, Column } from "../components/ReportTable";
import { SegmentedTabs } from "../../../shared/components/ui/SegmentedTabs";

interface ProductProblemCount {
  product: string;
  subproduct: string | null;
  problem: string;
  count: number;
}

interface CustomerConversationCount {
  customerName: string;
  conversationCount: number;
}

type ReportTab = "product-problem" | "customer-conversations";

const tabs = [
  { id: "product-problem", label: "Produto e Problema", icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "customer-conversations", label: "Conversas por Cliente", icon: <Users className="w-4 h-4" /> },
];

const productProblemColumns: Column<ProductProblemCount>[] = [
  { key: "product", header: "Produto" },
  { key: "subproduct", header: "Subproduto" },
  { key: "problem", header: "Problema" },
  { 
    key: "count", 
    header: "Quantidade", 
    align: "right",
    render: (value: number) => value.toLocaleString("pt-BR"),
  },
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

  const productProblemQuery = useReportData<ProductProblemCount>({
    endpoint: "/api/reports/product-problem-counts",
    period,
    queryKey: "product-problem-counts",
    limit: 10,
  });

  const customerConversationQuery = useReportData<CustomerConversationCount>({
    endpoint: "/api/reports/customer-conversation-counts",
    period,
    queryKey: "customer-conversation-counts",
    limit: 10,
  });

  const handleRefresh = () => {
    if (activeTab === "product-problem") {
      productProblemQuery.refetch();
    } else {
      customerConversationQuery.refetch();
    }
  };

  const isFetching = activeTab === "product-problem" 
    ? productProblemQuery.isFetching 
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
        <ReportTable<ProductProblemCount>
          title="Contagem por Produto e Problema"
          columns={productProblemColumns}
          data={productProblemQuery.data}
          isLoading={productProblemQuery.isLoading}
          isError={productProblemQuery.isError}
          error={productProblemQuery.error}
          onRetry={() => productProblemQuery.refetch()}
          page={productProblemQuery.page}
          totalPages={productProblemQuery.totalPages}
          total={productProblemQuery.total}
          showingFrom={productProblemQuery.showingFrom}
          showingTo={productProblemQuery.showingTo}
          onPreviousPage={productProblemQuery.previousPage}
          onNextPage={productProblemQuery.nextPage}
          hasPreviousPage={productProblemQuery.hasPreviousPage}
          hasNextPage={productProblemQuery.hasNextPage}
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
