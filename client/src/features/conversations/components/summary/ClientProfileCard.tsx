import { useState } from "react";
import { Building2, User2, ChevronDown, ChevronRight, Store, CreditCard, MapPin, FileText, Package } from "lucide-react";
import type { ClientHubData } from "./types";

interface ClientProfileCardProps {
  data?: ClientHubData | null;
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  
  const rounded = Math.round(num);
  const formatted = rounded.toLocaleString('pt-BR');
  return `R$ ${formatted}`;
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

const categoryConfig: Record<string, { icon: typeof Store; color: string; bgColor: string; order: number }> = {
  "Atributos Marketplace": { icon: Store, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", order: 1 },
  "Atributos Pago": { icon: CreditCard, color: "text-green-600", bgColor: "bg-green-50 border-green-200", order: 2 },
  "Informações cadastrais": { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", order: 3 },
  "Localização": { icon: MapPin, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200", order: 4 },
  "Outros": { icon: Package, color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200", order: 99 },
};

function getCategoryConfig(category: string) {
  return categoryConfig[category] || categoryConfig["Outros"];
}

export function ClientProfileCard({ data }: ClientProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = data && data.campos && Object.keys(data.campos).length > 0;

  const groupedFields: Record<string, { key: string; label: string; value: string; dataType: string }[]> = {};
  
  if (hasData && data.campos) {
    Object.entries(data.campos).forEach(([key, field]) => {
      const category = field.category || "Outros";
      if (!groupedFields[category]) {
        groupedFields[category] = [];
      }
      groupedFields[category].push({
        key,
        label: field.label,
        value: field.value,
        dataType: field.dataType,
      });
    });
  }

  const sortedCategories = Object.keys(groupedFields).sort((a, b) => {
    return getCategoryConfig(a).order - getCategoryConfig(b).order;
  });

  const fieldCount = hasData ? Object.keys(data.campos!).length : 0;

  return (
    <div className="rounded-lg p-3 bg-indigo-50 border border-indigo-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-indigo-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-indigo-600" />
        )}
        <div className="text-indigo-600">
          <Building2 className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Perfil do Cliente</h4>
        {hasData && (
          <span className="ml-auto text-xs text-indigo-600 font-medium">{fieldCount} campos</span>
        )}
        {!hasData && (
          <span className="ml-auto text-xs text-gray-400">Sem dados</span>
        )}
      </button>
      
      {isExpanded && (
        <>
          {!hasData ? (
            <div className="flex items-center gap-2 text-gray-400 py-2 mt-2">
              <User2 className="w-4 h-4" />
              <span className="text-sm">Dados do cliente não disponíveis</span>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {data.cnpj && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">CNPJ:</span>
                  <span className="text-sm font-medium text-gray-700">{formatCNPJ(data.cnpj)}</span>
                  {data.cnpjValido !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${data.cnpjValido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {data.cnpjValido ? 'Válido' : 'Inválido'}
                    </span>
                  )}
                </div>
              )}
              
              {sortedCategories.map((category) => {
                const fields = groupedFields[category];
                const config = getCategoryConfig(category);
                const IconComponent = config.icon;
                
                return (
                  <div key={category} className={`rounded-md p-2.5 border ${config.bgColor}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <IconComponent className={`w-3.5 h-3.5 ${config.color}`} />
                      <span className={`text-xs font-semibold ${config.color}`}>{category}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {fields.map((field) => (
                        <div key={field.key} className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 flex-shrink-0">{field.label}:</span>
                          <span className="text-sm font-medium text-gray-700">
                            {field.dataType === 'number' ? formatCurrency(field.value) : (field.value || '-')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
