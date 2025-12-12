import { FilterBar as GenericFilterBar } from "../../../shared/components/ui";

const EMOTION_OPTIONS = [
  { value: "1", label: "Positivo" },
  { value: "2", label: "Bom" },
  { value: "3", label: "Neutro" },
  { value: "4", label: "Irritado" },
  { value: "5", label: "Muito irritado" },
];

const USER_AUTHENTICATED_OPTIONS = [
  { value: "authenticated", label: "Autenticado" },
  { value: "not_authenticated", label: "Nao autenticado" },
];

const HANDLED_BY_N1AGO_OPTIONS = [
  { value: "yes", label: "Passou pelo N1ago" },
];

interface FilterBarProps {
  productStandards: string[];
  intents: string[];
  productStandardFilter: string;
  intentFilter: string;
  emotionLevelFilter: string;
  clientFilter: string;
  userAuthenticatedFilter: string;
  handledByN1agoFilter: string;
  onProductStandardChange: (value: string) => void;
  onIntentChange: (value: string) => void;
  onEmotionLevelChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onUserAuthenticatedChange: (value: string) => void;
  onHandledByN1agoChange: (value: string) => void;
  onClear: () => void;
}

export function FilterBar({
  productStandards,
  intents,
  productStandardFilter,
  intentFilter,
  emotionLevelFilter,
  clientFilter,
  userAuthenticatedFilter,
  handledByN1agoFilter,
  onProductStandardChange,
  onIntentChange,
  onEmotionLevelChange,
  onClientChange,
  onUserAuthenticatedChange,
  onHandledByN1agoChange,
  onClear,
}: FilterBarProps) {
  return (
    <GenericFilterBar
      filters={[
        { type: "search", value: clientFilter, onChange: onClientChange, placeholder: "Buscar..." },
        { type: "select", value: productStandardFilter, onChange: onProductStandardChange, placeholder: "Produtos", options: productStandards },
        { type: "select", value: intentFilter, onChange: onIntentChange, placeholder: "Intencoes", options: intents },
        { type: "select", value: emotionLevelFilter, onChange: onEmotionLevelChange, placeholder: "Emocao", options: EMOTION_OPTIONS },
        { type: "select", value: userAuthenticatedFilter, onChange: onUserAuthenticatedChange, placeholder: "Usuario", options: USER_AUTHENTICATED_OPTIONS },
        { type: "select", value: handledByN1agoFilter, onChange: onHandledByN1agoChange, placeholder: "N1ago", options: HANDLED_BY_N1AGO_OPTIONS },
      ]}
      onClear={onClear}
    />
  );
}
