import { useLocation } from "wouter";
import { Building2, ChevronRight } from "lucide-react";
import { LoadingState, EmptyState, Pagination } from "../shared/components";
import { useDateFormatters } from "../shared/hooks";
import { usePaginatedQuery } from "../shared/hooks";

interface OrganizationStandard {
  id: number;
  cnpj: string | null;
  cnpjRoot: string;
  source: string;
  name: string | null;
  metadata: any;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export function OrganizationsListContent() {
  const [, navigate] = useLocation();
  const { formatDateTime } = useDateFormatters();

  const {
    data: organizations,
    total,
    page,
    totalPages,
    isLoading,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
  } = usePaginatedQuery<OrganizationStandard>({
    queryKey: "organizations-standard",
    endpoint: "/api/organizations-standard",
    limit: 20,
    dataKey: "organizations",
  });

  const formatCnpjRoot = (cnpjRoot: string) => {
    if (cnpjRoot.length === 8) {
      return `${cnpjRoot.slice(0, 2)}.${cnpjRoot.slice(2, 5)}.${cnpjRoot.slice(5, 8)}`;
    }
    return cnpjRoot;
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (organizations.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="w-12 h-12 text-gray-300" />}
        title="Nenhuma organização registrada ainda."
        description="As organizações serão cadastradas quando mensagens chegarem via webhook."
      />
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ Raiz</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ Completo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último contato</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {organizations.map((org) => (
              <tr 
                key={org.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/cadastro/organizations/${encodeURIComponent(org.cnpjRoot)}`)}
              >
                <td className="px-4 py-3 text-sm text-gray-900">{org.name || "-"}</td>
                <td className="px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800">
                  {formatCnpjRoot(org.cnpjRoot)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{org.cnpj || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {org.lastSeenAt ? formatDateTime(org.lastSeenAt) : "-"}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  <ChevronRight className="w-5 h-5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-200">
        {organizations.map((org) => (
          <div 
            key={org.id} 
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => navigate(`/cadastro/organizations/${encodeURIComponent(org.cnpjRoot)}`)}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{org.name || "-"}</p>
                <p className="text-sm text-blue-600 mt-0.5 truncate">{formatCnpjRoot(org.cnpjRoot)}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                  {org.lastSeenAt && <span>Último: {formatDateTime(org.lastSeenAt)}</span>}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        showingFrom={showingFrom}
        showingTo={showingTo}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        onNextPage={nextPage}
        onPreviousPage={previousPage}
      />
    </>
  );
}
