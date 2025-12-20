import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TagInputProps {
  label: string;
  labelIcon?: LucideIcon;
  labelHint?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
  colorScheme?: "purple" | "amber" | "orange" | "gray";
  maxVisible?: number;
}

const colorSchemes = {
  purple: {
    label: "text-purple-600",
    border: "border-purple-200",
    focusRing: "focus:ring-purple-500 focus:border-purple-500",
    button: "bg-purple-600 hover:bg-purple-700",
    tag: "bg-purple-50 border-purple-200 text-purple-700",
  },
  amber: {
    label: "text-amber-600",
    border: "border-amber-200",
    focusRing: "focus:ring-amber-500 focus:border-amber-500",
    button: "bg-amber-500 hover:bg-amber-600",
    tag: "bg-amber-50 border-amber-200 text-amber-700",
  },
  orange: {
    label: "text-orange-600",
    border: "border-orange-200",
    focusRing: "focus:ring-orange-500 focus:border-orange-500",
    button: "bg-orange-500 hover:bg-orange-600",
    tag: "bg-orange-50 border-orange-200 text-orange-700",
  },
  gray: {
    label: "text-gray-600",
    border: "border-gray-200",
    focusRing: "focus:ring-gray-500 focus:border-gray-500",
    button: "bg-gray-500 hover:bg-gray-600",
    tag: "bg-gray-50 border-gray-200 text-gray-700",
  },
};

export function TagInput({
  label,
  labelIcon: LabelIcon,
  labelHint,
  placeholder,
  values,
  onChange,
  colorScheme = "gray",
  maxVisible = 6,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const colors = colorSchemes[colorScheme];

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const visibleTags = isExpanded ? values : values.slice(0, maxVisible);
  const hiddenCount = values.length - maxVisible;
  const showExpandButton = values.length > maxVisible;

  return (
    <div>
      <label className={`flex items-center gap-1.5 text-xs font-medium ${colors.label} mb-1.5`}>
        {LabelIcon && <LabelIcon className="w-3.5 h-3.5" />}
        {label}
        {labelHint && (
          <span className="text-xs text-gray-400 font-normal ml-1">({labelHint})</span>
        )}
      </label>
      
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`flex-1 px-3 py-2 text-sm border ${colors.border} rounded-lg ${colors.focusRing} focus:ring-2 transition-colors bg-white`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={handleAdd}
          className={`px-3 py-2 ${colors.button} text-white rounded-lg transition-colors`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleTags.map((item, index) => (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-lg ${colors.tag}`}
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemove(values.indexOf(item))}
                className="hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          
          {showExpandButton && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  +{hiddenCount} mais
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
