import { EMOTION_CONFIG, formatNumber } from "./config";
import type { DashboardEmotionItem } from "../../../types";
import { Link } from "wouter";

interface EmotionsCardProps {
  emotionStats24h: { items: DashboardEmotionItem[]; total: number } | undefined;
  emotionStats1h: { items: DashboardEmotionItem[]; total: number } | undefined;
}

export function EmotionsCard({ emotionStats24h, emotionStats1h }: EmotionsCardProps) {
  const items24h = emotionStats24h?.items || [];
  const items1h = emotionStats1h?.items || [];
  const total24h = emotionStats24h?.total || 0;
  const total1h = emotionStats1h?.total || 0;
  const emotionMap24h = new Map(items24h.map(e => [e.emotionLevel, e.count]));
  const emotionMap1h = new Map(items1h.map(e => [e.emotionLevel, e.count]));
  const emotionLevels = [1, 2, 3, 4, 5, 0];
  
  const hasData = emotionLevels.some(level => emotionMap24h.has(level));
  
  if (!hasData) {
    return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
  }
  
  return (
    <div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-[10px] font-bold text-gray-500 uppercase">Sentimento</span>
        <div className="flex gap-3">
          <span className="text-[10px] font-bold text-gray-500 w-12 text-right">1h</span>
          <span className="text-[10px] font-bold text-gray-500 w-12 text-right">24h</span>
        </div>
      </div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-200 bg-pink-50 -mx-5 px-5">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex gap-3">
          <span className="font-bold text-pink-600 w-12 text-right text-sm">{formatNumber(total1h)}</span>
          <span className="font-bold text-pink-600 w-12 text-right text-sm">{formatNumber(total24h)}</span>
        </div>
      </div>
      <div className="space-y-1 mt-2">
        {emotionLevels.map((level) => {
          const config = EMOTION_CONFIG[level];
          const count24h = emotionMap24h.get(level);
          const count1h = emotionMap1h.get(level);
          
          return (
            <div key={level} className="flex items-center justify-between py-1 text-sm">
              <Link href={`/atendimentos?emotionLevel=${level}`} className="text-gray-700 hover:text-pink-600 flex-1">
                {config.emoji} {config.label}
              </Link>
              <div className="flex gap-3">
                <span className="text-gray-500 w-12 text-right text-xs">
                  {count1h !== undefined && count1h > 0 ? formatNumber(count1h) : '-'}
                </span>
                <span className={`${config.color} w-12 text-right text-xs font-medium`}>
                  {count24h !== undefined ? formatNumber(count24h) : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
