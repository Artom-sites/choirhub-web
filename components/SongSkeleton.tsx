"use client";

export default function SongSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="space-y-0">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-0 border-b border-border/30 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-surface-highlight flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-4 bg-surface-highlight rounded-lg w-3/4" />
                        <div className="h-3 bg-surface-highlight rounded-lg w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}
