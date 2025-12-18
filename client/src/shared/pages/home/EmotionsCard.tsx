import { EMOTION_CONFIG, formatNumber } from "./config";
import type { DashboardEmotionItem } from "../../../types";
import { Link } from "wouter";

interface EmotionsCardProps {
  emotionStats: { items: DashboardEmotionItem[]; total: number } | undefined;
}

export function EmotionsCard({ emotionStats }: EmotionsCardProps) {
  const items = emotionStats?.items || [];
  const total = emotionStats?.total || 0;
  const emotionMap = new Map(items.map(e => [e.emotionLevel, e.count]));
  const emotionLevels = [1, 2, 3, 4, 5, 0];
  
  const hasData = emotionLevels.some(level => emotionMap.has(level));
  
  if (!hasData) {
    return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
  }
  
  return (
    <div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL (24h)</span>
        <span className="font-bold text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded text-xs">
          {formatNumber(total)}
        </span>
      </div>
      <div className="space-y-1 mt-2">
        {emotionLevels.map((level) => {
          const config = EMOTION_CONFIG[level];
          const count = emotionMap.get(level);
          
          return (
            <div key={level} className="flex items-center justify-between py-1 text-sm">
              <Link href={`/atendimentos?emotionLevel=${level}`} className="text-gray-700 hover:text-pink-600">
                {config.emoji} {config.label}
              </Link>
              {count !== undefined ? (
                <span className={`${config.color} ${config.bgColor} px-1.5 py-0.5 rounded text-xs font-medium`}>
                  {formatNumber(count)}
                </span>
              ) : (
                <span className="text-gray-300 text-xs">-</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
