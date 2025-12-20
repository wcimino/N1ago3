import { FilterBar as GenericFilterBar } from "../../../shared/components/ui";
import { EMOTION_OPTIONS, USER_AUTHENTICATED_OPTIONS, HANDLED_BY_N1AGO_OPTIONS } from "../../../shared/constants";

interface FilterBarProps {
  productStandards: string[];
  objectiveProblems: string[];
  customerRequestTypes: string[];
  productStandardFilter: string;
  emotionLevelFilter: string;
  clientFilter: string;
  userAuthenticatedFilter: string;
  handledByN1agoFilter: string;
  objectiveProblemFilter: string;
  customerRequestTypeFilter: string;
  onProductStandardChange: (value: string) => void;
  onEmotionLevelChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onUserAuthenticatedChange: (value: string) => void;
  onHandledByN1agoChange: (value: string) => void;
  onObjectiveProblemChange: (value: string) => void;
  onCustomerRequestTypeChange: (value: string) => void;
  onClear: () => void;
}

export function FilterBar({
  productStandards,
  objectiveProblems,
  customerRequestTypes,
  productStandardFilter,
  emotionLevelFilter,
  clientFilter,
  userAuthenticatedFilter,
  handledByN1agoFilter,
  objectiveProblemFilter,
  customerRequestTypeFilter,
  onProductStandardChange,
  onEmotionLevelChange,
  onClientChange,
  onUserAuthenticatedChange,
  onHandledByN1agoChange,
  onObjectiveProblemChange,
  onCustomerRequestTypeChange,
  onClear,
}: FilterBarProps) {
  return (
    <GenericFilterBar
      filters={[
        { type: "search", value: clientFilter, onChange: onClientChange, placeholder: "Buscar..." },
        { type: "select", value: productStandardFilter, onChange: onProductStandardChange, placeholder: "Produtos", options: productStandards },
        { type: "select", value: customerRequestTypeFilter, onChange: onCustomerRequestTypeChange, placeholder: "Tipo Solicitacao", options: customerRequestTypes },
        { type: "select", value: objectiveProblemFilter, onChange: onObjectiveProblemChange, placeholder: "Problema", options: objectiveProblems },
        { type: "select", value: emotionLevelFilter, onChange: onEmotionLevelChange, placeholder: "Emocao", options: EMOTION_OPTIONS },
        { type: "select", value: userAuthenticatedFilter, onChange: onUserAuthenticatedChange, placeholder: "Usuario", options: USER_AUTHENTICATED_OPTIONS },
        { type: "select", value: handledByN1agoFilter, onChange: onHandledByN1agoChange, placeholder: "N1ago", options: HANDLED_BY_N1AGO_OPTIONS },
      ]}
      onClear={onClear}
    />
  );
}
