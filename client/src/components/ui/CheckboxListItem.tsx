interface CheckboxListItemProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}

export function CheckboxListItem({ label, sublabel, checked, onChange }: CheckboxListItemProps) {
  return (
    <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 rounded border-gray-300"
      />
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {sublabel && <span className="ml-2 text-xs text-gray-500">({sublabel})</span>}
      </div>
    </label>
  );
}
