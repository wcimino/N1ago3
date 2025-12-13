import { ReactNode } from "react";
import { SegmentedTabs } from "./SegmentedTabs";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  primaryTabs?: Tab[];
  primaryActiveTab?: string;
  onPrimaryTabChange?: (tabId: string) => void;
  headerToggleLabel?: string;
  headerToggleIcon?: ReactNode;
  headerToggleActive?: boolean;
  onHeaderToggle?: () => void;
  showHeaderToggle?: boolean;
  secondaryTabs?: Tab[];
  secondaryActiveTab?: string;
  onSecondaryTabChange?: (tabId: string) => void;
  showSecondaryTabs?: boolean;
}

export function PageHeader({
  title,
  icon,
  primaryTabs,
  primaryActiveTab = "",
  onPrimaryTabChange,
  headerToggleLabel,
  headerToggleIcon,
  headerToggleActive = false,
  onHeaderToggle,
  showHeaderToggle = true,
  secondaryTabs,
  secondaryActiveTab = "",
  onSecondaryTabChange,
  showSecondaryTabs = true,
}: PageHeaderProps) {
  return (
    <>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {showHeaderToggle && headerToggleLabel && onHeaderToggle && (
            <button
              onClick={onHeaderToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                headerToggleActive
                  ? "bg-purple-100 text-purple-700"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              {headerToggleIcon}
              <span className="hidden sm:inline">{headerToggleLabel}</span>
            </button>
          )}
          {primaryTabs && onPrimaryTabChange && (
            <SegmentedTabs
              tabs={primaryTabs}
              activeTab={primaryActiveTab}
              onChange={onPrimaryTabChange}
              iconOnlyMobile
            />
          )}
        </div>
      </div>
      {showSecondaryTabs && secondaryTabs && onSecondaryTabChange && (
        <div className="px-4 py-3 border-b">
          <SegmentedTabs
            tabs={secondaryTabs}
            activeTab={secondaryActiveTab}
            onChange={onSecondaryTabChange}
            iconOnlyMobile
          />
        </div>
      )}
    </>
  );
}
