import { formatDistanceToNow, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function toDate(date: string | Date): Date {
  return typeof date === "string" ? parseISO(date) : date;
}

export function formatDateTime(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

export function formatDateTimeShort(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatDateTimeWithPrefix(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDate(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM/yyyy", { locale: ptBR });
}

export function formatShortDateTime(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "dd/MM HH:mm", { locale: ptBR });
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true, locale: ptBR });
}

export function formatTime(date: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(date), timezone, "HH:mm:ss", { locale: ptBR });
}
