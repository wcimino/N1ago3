import { FileText, Download } from "lucide-react";
import type { FilePayload } from "./types";
import { formatFileSize } from "./utils";

interface FileContentProps {
  payload: FilePayload;
  fileName?: string;
}

export function FileContent({ payload, fileName }: FileContentProps) {
  const displayName = fileName || payload.altText || payload.text || "Arquivo";
  const fileSize = formatFileSize(payload.mediaSize);
  
  return (
    <a 
      href={payload.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
    >
      <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
        <FileText className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
        {fileSize && (
          <p className="text-xs text-gray-500">{fileSize}</p>
        )}
      </div>
      <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
    </a>
  );
}
