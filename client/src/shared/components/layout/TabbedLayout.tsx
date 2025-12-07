import type { ComponentType } from "react";
import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";

export interface TabConfig {
  path: string;
  label: string;
  component: ComponentType;
  matchPaths?: string[];
}

export interface TabbedLayoutProps {
  title: string;
  basePath: string;
  defaultTab: string;
  tabs: TabConfig[];
}

export function TabbedLayout({ title, basePath, defaultTab, tabs }: TabbedLayoutProps) {
  const [location, setLocation] = useLocation();

  const activeTab = useMemo(() => {
    const exactMatch = tabs.find((tab) => 
      location === tab.path || location === `${tab.path}/`
    );
    if (exactMatch) return exactMatch;

    const pathMatches = tabs.filter((tab) => location.startsWith(tab.path));
    if (pathMatches.length > 0) {
      return pathMatches.reduce((best, tab) => 
        tab.path.length > best.path.length ? tab : best
      );
    }

    return tabs.find((tab) => 
      tab.matchPaths?.some((p) => location === p || location === `${p}/`)
    );
  }, [location, tabs]);

  useEffect(() => {
    if (location === basePath || location === `${basePath}/`) {
      setLocation(defaultTab, { replace: true });
    }
  }, [location, basePath, defaultTab, setLocation]);

  const CurrentPage = activeTab?.component ?? tabs[0].component;

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">{title}</h1>
        <div className="border-b border-gray-200 -mx-3 px-3 sm:mx-0 sm:px-0">
          <nav className="flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide pb-px" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`py-2 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <CurrentPage />
    </div>
  );
}
