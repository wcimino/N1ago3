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
  return (
    <div className={`bg-gray-100 p-1 rounded-lg flex overflow-x-auto ${className}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-shrink-0 flex items-center justify-center gap-1 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
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
  );
}
