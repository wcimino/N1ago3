import { ChevronDown } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function SegmentedTabs({ tabs, activeTab, onChange, className = "" }: SegmentedTabsProps) {
  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <>
      <div className={`hidden md:flex bg-gray-100 p-1 rounded-lg ${className}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={`md:hidden ${className}`}>
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </div>
        </div>
        {activeTabData && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            {activeTabData.icon}
            <span>Seção atual</span>
          </div>
        )}
      </div>
    </>
  );
}
