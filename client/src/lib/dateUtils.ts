import { formatDistanceToNow, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function toDate(date: string | Date): Date {
  if (typeof date === "string") {
    if (!date.endsWith("Z") && !date.includes("+") && !date.includes("-", 10)) {
      return parseISO(date + "Z");
    }
    return parseISO(date);
  }
  return date;
}

export function formatDateTime(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** @deprecated Use formatDateTime instead */
export const formatDateTimeShort = formatDateTime;

/** @deprecated Use formatDateTime instead */
export const formatShortDateTime = formatDateTime;

export function formatDateTimeWithPrefix(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDate(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy", { locale: ptBR });
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true, locale: ptBR });
}

export function formatTime(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "HH:mm:ss", { locale: ptBR });
}
