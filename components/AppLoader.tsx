import { Loader2 } from "lucide-react";

export default function AppLoader() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-text-secondary text-sm font-medium tracking-wide animate-pulse">
                Завантаження...
            </p>
        </div>
    );
}
