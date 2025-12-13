import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useReportData, PeriodFilter } from "../hooks/useReportData";
import { PeriodFilter as PeriodFilterComponent } from "../components/PeriodFilter";
import { ReportTable, Column } from "../components/ReportTable";

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
  const [period, setPeriod] = useState<PeriodFilter>("24h");

  const productProblemQuery = useReportData<ProductProblemCount>({
    endpoint: "/api/reports/product-problem-counts",
    period,
    queryKey: "product-problem-counts",
  });

  const customerConversationQuery = useReportData<CustomerConversationCount>({
    endpoint: "/api/reports/customer-conversation-counts",
    period,
    queryKey: "customer-conversation-counts",
  });

  const handleRefresh = () => {
    productProblemQuery.refetch();
    customerConversationQuery.refetch();
  };

  const isFetching = productProblemQuery.isFetching || customerConversationQuery.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-500">Análise de atendimentos por produto, problema e cliente</p>
          </div>
        </div>
        <PeriodFilterComponent
          value={period}
          onChange={setPeriod}
          onRefresh={handleRefresh}
          isRefreshing={isFetching}
        />
      </div>

      <ReportTable<ProductProblemCount>
        title="Contagem por Produto e Problema"
        columns={productProblemColumns}
        data={productProblemQuery.data}
        isLoading={productProblemQuery.isLoading}
        isError={productProblemQuery.isError}
        error={productProblemQuery.error as Error}
        onRetry={() => productProblemQuery.refetch()}
      />

      <ReportTable<CustomerConversationCount>
        title="Conversas por Cliente"
        columns={customerConversationColumns}
        data={customerConversationQuery.data}
        isLoading={customerConversationQuery.isLoading}
        isError={customerConversationQuery.isError}
        error={customerConversationQuery.error as Error}
        onRetry={() => customerConversationQuery.refetch()}
      />
    </div>
  );
}
