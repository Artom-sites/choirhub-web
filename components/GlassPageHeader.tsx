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
  rightActions?: GlassAction[];
  children?: ReactNode; // Optional extra tabs that still render in DOM below the native header
  onBack?: () => void;
}

export default function GlassPageHeader({
  title,
  subtitle,
  rightActions = [],
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

    // Sync configuration to iOS native header
    const syncToNative = () => {
      if (
        Capacitor.isNativePlatform() &&
        (window as any).webkit?.messageHandlers?.innerHeaderSync
      ) {
        const payload = {
          title: title || "",
          subtitle: subtitle || "",
          rightActions: rightActions.map(a => ({
            id: a.id,
            icon: a.icon,
            color: a.color || "default"
          }))
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
    };
  }, [title, subtitle, rightActions]);

  // If there are children (like tabs), render them below the reserved native header space
  return (
    <div className="w-full relative z-30">
      {/* Spacer to push content below the native iOS floating pill header */}
      <div className="h-[calc(48px+8px+env(safe-area-inset-top))] w-full pointer-events-none" />
      
      {/* Optional sub-header content (e.g. tab bar) rendered in DOM */}
      {children && (
        <div className="px-4 pb-2 bg-background/90 backdrop-blur-md border-b border-border sticky top-[calc(56px+env(safe-area-inset-top))]">
          {children}
        </div>
      )}
    </div>
  );
}
