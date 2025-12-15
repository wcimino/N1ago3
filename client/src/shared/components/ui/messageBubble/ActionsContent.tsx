import { ExternalLink } from "lucide-react";
import type { MessageAction } from "./types";
import { isValidActionUri } from "./utils";

interface ActionsContentProps {
  actions: MessageAction[];
}

export function ActionsContent({ actions }: ActionsContentProps) {
  const replyActions = actions.filter(a => a.type === "reply" || a.type === "postback");
  const linkActions = actions.filter(a => a.type !== "reply" && a.type !== "postback");

  return (
    <div className="flex flex-col gap-2 mt-2">
      {replyActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {replyActions.map((action, idx) => (
            <span
              key={`reply-${idx}`}
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-300"
            >
              {action.text}
            </span>
          ))}
        </div>
      )}
      {linkActions.map((action, idx) => {
        const safeUri = isValidActionUri(action.uri) ? action.uri : undefined;
        if (!safeUri) return null;
        
        return (
          <a
            key={`link-${idx}`}
            href={safeUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-full hover:bg-primary-900 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>{action.text}</span>
          </a>
        );
      })}
    </div>
  );
}
