import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function formatShortDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "HH:mm:ss", { locale: ptBR });
}
