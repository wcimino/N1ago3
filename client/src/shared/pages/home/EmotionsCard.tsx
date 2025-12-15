import { StatsTableHeader, StatsRow } from "../../components";
import { EMOTION_CONFIG, formatNumber } from "./config";
import type { EmotionStatsResponse } from "../../../types";

interface EmotionsCardProps {
  emotionStats: EmotionStatsResponse | undefined;
}

export function EmotionsCard({ emotionStats }: EmotionsCardProps) {
  const lastHourItems = emotionStats?.last_hour?.items || [];
  const todayItems = emotionStats?.today?.items || [];
  const lastHourMap = new Map(lastHourItems.map(e => [e.emotionLevel, e.count]));
  const todayMap = new Map(todayItems.map(e => [e.emotionLevel, e.count]));
  const emotionLevels = [1, 2, 3, 4, 5, 0];
  
  const hasData = emotionLevels.some(level => lastHourMap.has(level) || todayMap.has(level));
  
  if (!hasData) {
    return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
  }
  
  const totalLastHour = emotionStats?.last_hour?.total || 0;
  const totalToday = emotionStats?.today?.total || 0;
  
  return (
    <div>
      <StatsTableHeader colorScheme="pink" />
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          {totalLastHour ? (
            <span className="font-bold text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalLastHour)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          {totalToday ? (
            <span className="font-bold text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalToday)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          <div className="w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {emotionLevels.map((level) => {
          const config = EMOTION_CONFIG[level];
          return (
            <StatsRow
              key={level}
              label={<>{config.emoji} {config.label}</>}
              lastHourValue={lastHourMap.get(level)}
              todayValue={todayMap.get(level)}
              linkTo={`/atendimentos?emotionLevel=${level}`}
              linkTitle={`Ver atendimentos com sentimento ${config.label}`}
              customValueColor={config.color}
              customValueBgColor={config.bgColor}
              formatNumber={formatNumber}
            />
          );
        })}
      </div>
    </div>
  );
}
