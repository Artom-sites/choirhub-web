"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Preloader from "@/components/Preloader";

function SetupRedirectContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get("code");
        if (code) {
            // Use window.location.replace for a harder redirect that guarantees top-level page load
            // or router.replace. router.replace is fine.
            router.replace(`/?code=${code}`);
        } else {
            router.replace("/");
        }
    }, [router, searchParams]);

    return <Preloader />;
}

export default function SetupRedirect() {
    return (
        <Suspense fallback={<Preloader />}>
            <SetupRedirectContent />
        </Suspense>
    );
}
