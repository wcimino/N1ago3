import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

interface ModernSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

export function ModernSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  disabled = false,
  name,
}: ModernSelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectPrimitive.Trigger
        className={`
          inline-flex items-center justify-between w-full px-3 py-2 text-sm
          bg-white border border-gray-200 rounded-lg
          hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
          data-[placeholder]:text-gray-400
        `}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={`
            overflow-hidden bg-white rounded-xl border border-gray-200 shadow-lg
            animate-in fade-in-0 zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
            data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2
            z-50
          `}
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1 max-h-[300px]">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={`
                  relative flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer
                  outline-none select-none
                  data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700
                  data-[state=checked]:bg-blue-100 data-[state=checked]:text-blue-700 data-[state=checked]:font-medium
                  transition-colors duration-150
                `}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="w-4 h-4 text-blue-600" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
