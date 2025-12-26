import { useState } from "react";
import { Building2, User2, ChevronDown, ChevronRight } from "lucide-react";
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
              
              {Object.entries(groupedFields).map(([category, fields]) => (
                <div key={category} className="border-t border-indigo-100 pt-2">
                  <span className="text-xs text-indigo-600 font-medium">{category}</span>
                  <div className="grid grid-cols-1 gap-1 mt-1">
                    {fields.map((field) => (
                      <div key={field.key} className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 min-w-[80px]">{field.label}:</span>
                        <span className="text-sm text-gray-700">
                          {field.dataType === 'number' ? formatCurrency(field.value) : (field.value || '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
