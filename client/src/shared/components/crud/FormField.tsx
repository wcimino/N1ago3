import { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

interface BaseFieldProps {
  label: string;
  required?: boolean;
  className?: string;
}

interface InputFieldProps extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  type: "text" | "email" | "number" | "password" | "checkbox";
}

interface TextareaFieldProps extends BaseFieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  type: "textarea";
  rows?: number;
}

interface SelectFieldProps extends BaseFieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  type: "select";
  options: Array<{ value: string; label: string }>;
  emptyOption?: string;
}

interface CustomFieldProps extends BaseFieldProps {
  type: "custom";
  children: ReactNode;
}

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps | CustomFieldProps;

export function FormField(props: FormFieldProps) {
  const { label, required, className = "" } = props;
  const baseInputClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500";

  if (props.type === "checkbox") {
    const { type, label: _, required: __, className: ___, ...inputProps } = props;
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          type="checkbox"
          {...inputProps}
          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
        />
        <label htmlFor={inputProps.id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      </div>
    );
  }

  if (props.type === "custom") {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && "*"}
        </label>
        {props.children}
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && "*"}
      </label>
      
      {props.type === "textarea" ? (
        <textarea
          {...(props as TextareaFieldProps)}
          className={baseInputClasses}
          required={required}
        />
      ) : props.type === "select" ? (
        <select
          {...(props as Omit<SelectFieldProps, 'options' | 'emptyOption'>)}
          className={baseInputClasses}
          required={required}
        >
          {props.emptyOption !== undefined && (
            <option value="">{props.emptyOption}</option>
          )}
          {props.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          {...(props as InputFieldProps)}
          className={baseInputClasses}
          required={required}
        />
      )}
    </div>
  );
}
