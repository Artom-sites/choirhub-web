"use client";

import { ChevronLeft } from "lucide-react";
import { ReactNode } from "react";
import { useRouter } from "next/navigation";

interface GlassPageHeaderProps {
  /** Bold title of the screen */
  title?: string;
  /** Optional subtitle / metadata line */
  subtitle?: string;
  /** Left action — defaults to a Back button */
  leftAction?: ReactNode;
  /** Right side actions (icon buttons) */
  rightActions?: ReactNode;
  /** Extra content rendered below the title row (e.g. tab bar) */
  children?: ReactNode;
  /** Override the back navigation target */
  onBack?: () => void;
}

/**
 * Reusable inner-screen header with Apple Liquid Glass aesthetic.
 * Floats as a sticky bar at the top with blur/glass backdrop.
 */
export default function GlassPageHeader({
  title,
  subtitle,
  leftAction,
  rightActions,
  children,
  onBack,
}: GlassPageHeaderProps) {
  const router = useRouter();

  const backButton = (
    <button
      onClick={onBack ?? (() => router.back())}
      aria-label="Назад"
      className="
        w-10 h-10 rounded-full flex items-center justify-center
        bg-black/5 dark:bg-white/8
        backdrop-blur-sm
        border border-black/8 dark:border-white/10
        hover:bg-black/10 dark:hover:bg-white/12
        active:scale-95 transition-all duration-150
      "
    >
      <ChevronLeft className="w-5 h-5 text-text-primary" strokeWidth={2.5} />
    </button>
  );

  return (
    <header
      className="
        sticky top-0 z-30
        pt-[env(safe-area-inset-top)]
        bg-background/80 backdrop-blur-xl
        border-b border-black/8 dark:border-white/8
      "
      style={{ WebkitBackdropFilter: "blur(24px)" }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 h-14">
        {/* Left */}
        <div className="flex-shrink-0">
          {leftAction ?? backButton}
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          {title && (
            <h1
              className="
                font-bold text-[17px] text-text-primary leading-tight
                truncate
              "
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-[12px] text-text-secondary leading-tight truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right actions */}
        {rightActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {rightActions}
          </div>
        )}
      </div>

      {/* Optional children below the title row */}
      {children && <div>{children}</div>}
    </header>
  );
}

/** Reusable glass icon button for right-side actions */
export function GlassIconButton({
  onClick,
  children,
  active,
  danger,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        w-10 h-10 rounded-full flex items-center justify-center
        backdrop-blur-sm border transition-all duration-150 active:scale-90
        ${danger
          ? "bg-red-500/10 border-red-400/20 text-red-500 hover:bg-red-500/20"
          : active
            ? "bg-primary border-primary/30 text-background"
            : "bg-black/5 dark:bg-white/8 border-black/8 dark:border-white/10 text-text-secondary hover:text-text-primary hover:bg-black/10 dark:hover:bg-white/14"
        }
      `}
    >
      {children}
    </button>
  );
}
