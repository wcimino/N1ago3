import { CheckCircle, XCircle, AlertCircle, Loader2, Clock } from "lucide-react";
import { createElement } from "react";

export function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}min ${seconds}s`;
}

export function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return createElement(CheckCircle, { className: "w-5 h-5 text-green-500" });
    case "failed":
      return createElement(XCircle, { className: "w-5 h-5 text-red-500" });
    case "cancelled":
      return createElement(AlertCircle, { className: "w-5 h-5 text-yellow-500" });
    case "in_progress":
      return createElement(Loader2, { className: "w-5 h-5 text-blue-500 animate-spin" });
    default:
      return createElement(Clock, { className: "w-5 h-5 text-gray-400" });
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case "completed":
      return "Concluída";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelada";
    case "in_progress":
      return "Em andamento";
    default:
      return status;
  }
}

export function getProgressPercentage(processed: number, estimatedTotal: number): number {
  if (estimatedTotal <= 0) return 0;
  return Math.min(100, Math.round((processed / estimatedTotal) * 100));
}
