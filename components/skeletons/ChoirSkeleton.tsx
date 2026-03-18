export default function ChoirSkeleton() {
    return (
        <div className="flex flex-col gap-3 px-4 py-2 w-full animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-full bg-surface rounded-2xl p-4 flex flex-col gap-3 border border-border shadow-sm">
                    {/* Header Row: Date & Title */}
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-1/3 bg-surface-highlight rounded-md"></div>
                            <div className="h-5 w-3/4 bg-surface-highlight rounded-md"></div>
                        </div>
                        <div className="h-6 w-16 bg-surface-highlight rounded-full shrink-0"></div>
                    </div>

                    {/* Middle Row: Progress/Attendance Bars */}
                    <div className="space-y-2 mt-1">
                        <div className="h-2 w-full bg-surface-highlight rounded-full"></div>
                        <div className="flex gap-2">
                            <div className="h-2 w-1/4 bg-surface-highlight rounded-full"></div>
                            <div className="h-2 w-1/4 bg-surface-highlight rounded-full"></div>
                            <div className="h-2 w-1/4 bg-surface-highlight rounded-full"></div>
                        </div>
                    </div>

                    {/* Footer Row: Avatars & Status */}
                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-border">
                        <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-surface-highlight border-2 border-surface"></div>
                            <div className="w-6 h-6 rounded-full bg-surface-highlight border-2 border-surface"></div>
                            <div className="w-6 h-6 rounded-full bg-surface-highlight border-2 border-surface"></div>
                        </div>
                        <div className="h-6 w-20 bg-surface-highlight rounded-md"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}
