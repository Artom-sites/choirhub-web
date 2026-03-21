import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

interface GlassAction {
  id: string;
  icon: string;
  color?: "default" | "danger";
  onClick: () => void;
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
  children?: ReactNode; // Optional extra tabs that still render in DOM below the native header
  onBack?: () => void;
}

export default function GlassPageHeader({
  title,
  subtitle,
  tabs = [],
  activeTab = 0,
  onTabChange,
  rightActions = [],
  rightSegmented,
  children,
  onBack,
}: GlassPageHeaderProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Attach native action handler
    (window as any).__nativeInnerHeaderAction = (actionId: string) => {
      const action = rightActions.find((a) => a.id === actionId);
      if (action) {
        action.onClick();
      }
    };
    
    // Attach native tab handler
    (window as any).__nativeInnerHeaderTabClick = (index: number) => {
      if (onTabChange) {
        onTabChange(index);
      }
    };
    
    // Attach native right segmented handler
    (window as any).__nativeInnerHeaderRightSegmentClick = (index: number) => {
      if (rightSegmented?.onChange) {
        rightSegmented.onChange(index);
      }
    };

    // Sync configuration to iOS native header
    const syncToNative = () => {
      if (
        Capacitor.isNativePlatform() &&
        (window as any).webkit?.messageHandlers?.innerHeaderSync
      ) {
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
          } : undefined
        };
        try {
          (window as any).webkit.messageHandlers.innerHeaderSync.postMessage(payload);
        } catch (e) {
          console.error("Failed to sync inner header:", e);
        }
      }
    };

    syncToNative();

    return () => {
      delete (window as any).__nativeInnerHeaderAction;
      delete (window as any).__nativeInnerHeaderTabClick;
      delete (window as any).__nativeInnerHeaderRightSegmentClick;
    };
  }, [title, subtitle, tabs, activeTab, rightActions, rightSegmented?.items, rightSegmented?.active, onTabChange, rightSegmented?.onChange]);

  // If there are children (like tabs), render them below the reserved native header space
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
