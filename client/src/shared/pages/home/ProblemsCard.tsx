import { StatsTableHeader, StatsRow } from "../../components";
import { formatNumber } from "./config";
import type { ProblemStatsResponse } from "../../../types";

interface ProblemsCardProps {
  problemStats: ProblemStatsResponse | undefined;
}

export function ProblemsCard({ problemStats }: ProblemsCardProps) {
  const lastHourItems = problemStats?.last_hour?.items || [];
  const todayItems = problemStats?.today?.items || [];
  const lastHourMap = new Map(lastHourItems.map(p => [p.problemName, p.count]));
  const todayMap = new Map(todayItems.map(p => [p.problemName, p.count]));
  const allProblems = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
  
  allProblems.sort((a, b) => (todayMap.get(b) || 0) - (todayMap.get(a) || 0));
  
  if (allProblems.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum problema identificado</p>;
  }
  
  const totalLastHour = problemStats?.last_hour?.total || 0;
  const totalToday = problemStats?.today?.total || 0;
  
  const top5Problems = allProblems.slice(0, 5);
  const othersProblems = allProblems.slice(5);
  
  const othersLastHour = othersProblems.reduce((sum, p) => sum + (lastHourMap.get(p) || 0), 0);
  const othersToday = othersProblems.reduce((sum, p) => sum + (todayMap.get(p) || 0), 0);
  const othersCount = othersProblems.length;
  
  return (
    <div>
      <StatsTableHeader colorScheme="purple" />
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          {totalLastHour ? (
            <span className="font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalLastHour)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          {totalToday ? (
            <span className="font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalToday)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          <div className="w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {top5Problems.map((problem) => (
          <StatsRow
            key={problem}
            label={problem}
            lastHourValue={lastHourMap.get(problem)}
            todayValue={todayMap.get(problem)}
            colorScheme="purple"
            formatNumber={formatNumber}
          />
        ))}
        {othersCount > 0 && (
          <StatsRow
            label={`Outros (${othersCount})`}
            lastHourValue={othersLastHour || undefined}
            todayValue={othersToday || undefined}
            colorScheme="purple"
            formatNumber={formatNumber}
          />
        )}
      </div>
    </div>
  );
}
