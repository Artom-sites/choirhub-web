import { ReactNode, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

interface GlassAction {
  id: string;
  icon: string;
  color?: "default" | "danger";
  onClick: () => void;
}

// Hierarchical filter menu item (children → UIMenu submenu in Swift)
export interface FilterMenuItem {
  id: string;
  label: string;
  isActive: boolean;
  children?: FilterMenuItem[];
}

export interface FilterMenuGroup {
  items: FilterMenuItem[];
}

interface GlassPageHeaderProps {
  title?: string;
  subtitle?: string;
  tabs?: string[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
  rightActions?: GlassAction[];
  rightSegmented?: {
    items: string[];
    active: number;
    onChange: (index: number) => void;
  };
  searchInput?: {
    placeholder?: string;
    value: string;
    autoFocus?: boolean;
    onChange: (val: string) => void;
  };
  filterMenu?: FilterMenuGroup[];
  onFilterMenuSelect?: (itemId: string) => void;
  children?: ReactNode;
  onBack?: () => void;
  isActive?: boolean;
}

// Global registry to maintain header stack
interface MountedHeader {
  id: number;
  payload: any;
  callbacks: {
    back: () => void;
    action: (id: string) => void;
    tabClick: (index: number) => void;
    rightSegmentClick: (index: number) => void;
    searchChange: (val: string) => void;
    filterMenuSelect: (itemId: string) => void;
  };
}
let nextHeaderId = 0;
const mountedHeaders: MountedHeader[] = [];

function syncTopHeader() {
  if (mountedHeaders.length === 0) {
    (window as any).__nativeInnerHeaderBackClick = undefined;
    (window as any).__nativeInnerHeaderAction = undefined;
    (window as any).__nativeInnerHeaderTabClick = undefined;
    (window as any).__nativeInnerHeaderRightSegmentClick = undefined;
    (window as any).__nativeInnerHeaderSearchChange = undefined;
    (window as any).__nativeInnerHeaderFilterMenuSelect = undefined;
    return;
  }
  const top = mountedHeaders[mountedHeaders.length - 1];
  
  (window as any).__nativeInnerHeaderBackClick = top.callbacks.back;
  (window as any).__nativeInnerHeaderAction = top.callbacks.action;
  (window as any).__nativeInnerHeaderTabClick = top.callbacks.tabClick;
  (window as any).__nativeInnerHeaderRightSegmentClick = top.callbacks.rightSegmentClick;
  (window as any).__nativeInnerHeaderSearchChange = top.callbacks.searchChange;
  (window as any).__nativeInnerHeaderFilterMenuSelect = top.callbacks.filterMenuSelect;
  
  if (
    Capacitor.isNativePlatform() &&
    (window as any).webkit?.messageHandlers?.innerHeaderSync
  ) {
    try {
      (window as any).webkit.messageHandlers.innerHeaderSync.postMessage(top.payload);
    } catch (e) {
      console.error("Failed to sync inner header:", e);
    }
  }
}

export default function GlassPageHeader({
  title,
  subtitle,
  tabs = [],
  activeTab = 0,
  onTabChange,
  rightActions = [],
  rightSegmented,
  searchInput,
  filterMenu,
  onFilterMenuSelect,
  children,
  onBack,
  isActive = true,
}: GlassPageHeaderProps) {
  const router = useRouter();

  const idRef = useRef<number | null>(null);
  if (idRef.current === null) {
      idRef.current = nextHeaderId++;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const myId = idRef.current;
    
    if (!isActive) {
      const removeIdx = mountedHeaders.findIndex(h => h.id === myId);
      if (removeIdx >= 0) {
        mountedHeaders.splice(removeIdx, 1);
        syncTopHeader();
      }
      return;
    }

    const payload = {
      title: title || "",
      subtitle: subtitle || "",
      tabs: tabs,
      activeTab: activeTab,
      rightActions: rightActions.map(a => ({
        id: a.id,
        icon: a.icon,
        color: a.color || "default"
      })),
      rightSegmented: rightSegmented ? {
        items: rightSegmented.items,
        active: rightSegmented.active
      } : undefined,
      searchInput: searchInput ? {
        placeholder: searchInput.placeholder,
        value: searchInput.value,
        autoFocus: searchInput.autoFocus
      } : undefined,
      // Serialize filterMenu groups → [[[id, label, isActive, children?]]]
      filterMenu: filterMenu
        ? filterMenu.map(group => group.items.map(item => ({
            id: item.id,
            label: item.label,
            isActive: item.isActive,
            children: item.children?.map(c => ({ id: c.id, label: c.label, isActive: c.isActive }))
          })))
        : undefined
    };

    const callbacks = {
      back: () => {
        if (onBack) {
          onBack();
        } else {
          router.back();
        }
      },
      action: (actionId: string) => {
        const action = rightActions.find((a) => a.id === actionId);
        if (action) action.onClick();
      },
      tabClick: (index: number) => {
        if (onTabChange) onTabChange(index);
      },
      rightSegmentClick: (index: number) => {
        if (rightSegmented?.onChange) rightSegmented.onChange(index);
      },
      searchChange: (val: string) => {
        if (searchInput?.onChange) searchInput.onChange(val);
      },
      filterMenuSelect: (itemId: string) => {
        if (onFilterMenuSelect) onFilterMenuSelect(itemId);
      }
    };

    const headerData: MountedHeader = { id: myId as number, payload, callbacks };
    const idx = mountedHeaders.findIndex(h => h.id === myId);
    
    if (idx >= 0) {
      mountedHeaders[idx] = headerData;
    } else {
      mountedHeaders.push(headerData);
    }

    syncTopHeader();

    return () => {
      const removeIdx = mountedHeaders.findIndex(h => h.id === myId);
      if (removeIdx >= 0) {
        mountedHeaders.splice(removeIdx, 1);
        syncTopHeader();
      }
    };
  }, [title, subtitle, tabs, activeTab, rightActions, rightSegmented?.items, rightSegmented?.active, onTabChange, rightSegmented?.onChange, searchInput?.value, searchInput?.placeholder, searchInput?.autoFocus, searchInput?.onChange, filterMenu, onFilterMenuSelect, isActive]);

  return (
    <div className="w-full relative z-30">
      {/* Spacer to push content below the native iOS floating pill header */}
      <div className="h-[calc(48px+8px+env(safe-area-inset-top))] w-full pointer-events-none" />
      
      {/* Optional sub-header content (e.g. dom tabs) rendered in DOM */}
      {children ? (
        <div className="px-4 pb-2 bg-background/90 backdrop-blur-md border-b border-border sticky top-[calc(56px+env(safe-area-inset-top))]">
          {children}
        </div>
      ) : (tabs.length > 0 && !Capacitor.isNativePlatform()) ? (
        <div className="px-4 pb-2 bg-background/90 backdrop-blur-md border-b border-border sticky top-[calc(56px+env(safe-area-inset-top))]">
            <div className="flex bg-surface-highlight/50 p-1 rounded-xl">
                {tabs.map((tab, idx) => (
                    <button
                        key={idx}
                        onClick={() => onTabChange?.(idx)}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${activeTab === idx ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>
      ) : null}
    </div>
  );
}
