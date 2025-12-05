interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`w-12 h-6 rounded-full transition-colors ${
        enabled ? "bg-green-500" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
          enabled ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
