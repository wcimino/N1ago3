import { FilterBar as GenericFilterBar } from "../../../shared/components/ui";

const EMOTION_OPTIONS = [
  { value: "1", label: "😊 Positivo" },
  { value: "2", label: "🙂 Bom" },
  { value: "3", label: "😐 Neutro" },
  { value: "4", label: "😤 Irritado" },
  { value: "5", label: "😠 Muito irritado" },
];

interface FilterBarProps {
  productStandards: string[];
  intents: string[];
  productStandardFilter: string;
  intentFilter: string;
  emotionLevelFilter: string;
  clientFilter: string;
  onProductStandardChange: (value: string) => void;
  onIntentChange: (value: string) => void;
  onEmotionLevelChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onClear: () => void;
}

export function FilterBar({
  productStandards,
  intents,
  productStandardFilter,
  intentFilter,
  emotionLevelFilter,
  clientFilter,
  onProductStandardChange,
  onIntentChange,
  onEmotionLevelChange,
  onClientChange,
  onClear,
}: FilterBarProps) {
  return (
    <GenericFilterBar
      filters={[
        { type: "search", value: clientFilter, onChange: onClientChange, placeholder: "Buscar..." },
        { type: "select", value: productStandardFilter, onChange: onProductStandardChange, placeholder: "Produtos", placeholderMobile: "Prod.", options: productStandards },
        { type: "select", value: intentFilter, onChange: onIntentChange, placeholder: "Intenções", placeholderMobile: "Int.", options: intents },
        { type: "select", value: emotionLevelFilter, onChange: onEmotionLevelChange, placeholder: "Emoção", options: EMOTION_OPTIONS },
      ]}
      onClear={onClear}
    />
  );
}
