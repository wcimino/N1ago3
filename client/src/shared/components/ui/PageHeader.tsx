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
