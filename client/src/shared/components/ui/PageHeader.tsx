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
  secondaryTabs?: Tab[];
  secondaryActiveTab?: string;
  onSecondaryTabChange?: (tabId: string) => void;
  showSecondaryTabs?: boolean;
  tertiaryGroupLabel?: string;
  tertiaryGroupIcon?: ReactNode;
  tertiaryGroupActive?: boolean;
  onTertiaryGroupToggle?: () => void;
  tertiaryTabs?: Tab[];
  tertiaryActiveTab?: string;
  onTertiaryTabChange?: (tabId: string) => void;
  showTertiaryTabs?: boolean;
}

export function PageHeader({
  title,
  icon,
  primaryTabs,
  primaryActiveTab = "",
  onPrimaryTabChange,
  secondaryTabs,
  secondaryActiveTab = "",
  onSecondaryTabChange,
  showSecondaryTabs = true,
  tertiaryGroupLabel,
  tertiaryGroupIcon,
  tertiaryGroupActive = false,
  onTertiaryGroupToggle,
  tertiaryTabs,
  tertiaryActiveTab = "",
  onTertiaryTabChange,
  showTertiaryTabs = true,
}: PageHeaderProps) {
  return (
    <>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {primaryTabs && onPrimaryTabChange && (
          <SegmentedTabs
            tabs={primaryTabs}
            activeTab={primaryActiveTab}
            onChange={onPrimaryTabChange}
            iconOnlyMobile
          />
        )}
      </div>
      {showSecondaryTabs && secondaryTabs && onSecondaryTabChange && (
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <SegmentedTabs
            tabs={secondaryTabs}
            activeTab={secondaryActiveTab}
            onChange={onSecondaryTabChange}
            iconOnlyMobile
          />
          {showTertiaryTabs && tertiaryGroupLabel && onTertiaryGroupToggle && (
            <button
              onClick={onTertiaryGroupToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tertiaryGroupActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              {tertiaryGroupIcon}
              <span className="hidden sm:inline">{tertiaryGroupLabel}</span>
            </button>
          )}
        </div>
      )}
      {showTertiaryTabs && tertiaryGroupActive && tertiaryTabs && onTertiaryTabChange && (
        <div className="px-4 py-2 border-b bg-gray-50">
          <SegmentedTabs
            tabs={tertiaryTabs}
            activeTab={tertiaryActiveTab}
            onChange={onTertiaryTabChange}
            iconOnlyMobile
          />
        </div>
      )}
    </>
  );
}
