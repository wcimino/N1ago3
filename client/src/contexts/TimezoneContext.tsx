import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "UTC", label: "UTC (GMT+0)" },
  { value: "America/New_York", label: "Nova York (GMT-5)" },
  { value: "Europe/London", label: "Londres (GMT+0)" },
  { value: "Europe/Paris", label: "Paris (GMT+1)" },
] as const;

export type TimezoneValue = typeof TIMEZONE_OPTIONS[number]["value"];

const STORAGE_KEY = "n1ago_timezone";
const DEFAULT_TIMEZONE: TimezoneValue = "America/Sao_Paulo";

interface TimezoneContextType {
  timezone: TimezoneValue;
  setTimezone: (tz: TimezoneValue) => void;
}

const TimezoneContext = createContext<TimezoneContextType | null>(null);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<TimezoneValue>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && TIMEZONE_OPTIONS.some(opt => opt.value === stored)) {
      return stored as TimezoneValue;
    }
    return DEFAULT_TIMEZONE;
  });

  const setTimezone = (tz: TimezoneValue) => {
    setTimezoneState(tz);
    localStorage.setItem(STORAGE_KEY, tz);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, timezone);
  }, [timezone]);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error("useTimezone must be used within a TimezoneProvider");
  }
  return context;
}
