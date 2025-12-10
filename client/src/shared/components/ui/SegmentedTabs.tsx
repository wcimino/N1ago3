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
  iconOnlyMobile?: boolean;
}

export function SegmentedTabs({ tabs, activeTab, onChange, className = "", iconOnlyMobile = false }: SegmentedTabsProps) {
  return (
    <div className={`bg-gray-100 p-1 rounded-lg flex gap-1 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          title={tab.label}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 md:px-3 md:py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
            activeTab === tab.id
              ? "bg-white text-purple-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          {tab.icon}
          <span className={iconOnlyMobile ? "hidden md:inline" : ""}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
