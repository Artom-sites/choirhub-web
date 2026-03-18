"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface ChoirContextType {
    loadingChoir: boolean;
}

const ChoirContext = createContext<ChoirContextType | undefined>(undefined);

export function ChoirProvider({ children }: { children: ReactNode }) {
    const { userData } = useAuth();
    const [loadingChoir, setLoadingChoir] = useState(false);
    const previousChoirIdRef = useRef<string | null>(null);

    useEffect(() => {
        const currentChoirId = userData?.choirId || null;

        if (currentChoirId && previousChoirIdRef.current !== currentChoirId) {
            setLoadingChoir(true);

            // We set a small timeout to allow the network request in page.tsx 
            // to fire, and we'll clear this loading state when that resolves.
            // Ideally, the data-fetching itself should reside here soon,
            // but for now, we drop the skeleton after a brief guaranteed paint window,
            // or when the child component says it has loaded.
            const timer = setTimeout(() => {
                setLoadingChoir(false);
                previousChoirIdRef.current = currentChoirId;
            }, 600); // Temporary artificial drop if architecture isn't fully migrated.

            return () => clearTimeout(timer);
        } else if (!currentChoirId) {
            setLoadingChoir(false);
        }
    }, [userData?.choirId]);

    // Extend context as we move more domain data in here
    return (
        <ChoirContext.Provider value={{ loadingChoir }}>
            {children}
        </ChoirContext.Provider>
    );
}

export function useChoir() {
    const context = useContext(ChoirContext);
    if (context === undefined) {
        throw new Error("useChoir must be used within a ChoirProvider");
    }
    return context;
}
