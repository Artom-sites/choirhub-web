"use client";

import { useEffect, useState, useRef, CSSProperties } from "react";

/**
 * Premium Storytelling Preloader for MyChoir
 * Uses inline styles to avoid styled-jsx/Turbopack issues.
 */
export default function Preloader({
    inline = false,
}: {
    inline?: boolean;
}) {
    if (inline) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="relative w-16 h-16 flex items-center justify-center">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="absolute border border-primary/30 rounded-full animate-ping"
                            style={{
                                width: 16 + i * 16,
                                height: 16 + i * 16,
                                animationDelay: `${i * 0.3}s`,
                                animationDuration: "1.5s",
                            }}
                        />
                    ))}
                    <div className="w-2 h-2 bg-primary/40 rounded-full" />
                </div>
            </div>
        );
    }

    return <StorytellingPreloader />;
}

function StorytellingPreloader() {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const t1 = setTimeout(() => setPhase(1), 300);
        const t2 = setTimeout(() => setPhase(2), 700);
        const t3 = setTimeout(() => setPhase(3), 1200);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    // Inject keyframes + hide native SplashScreen once web content is painted
    useEffect(() => {
        const id = "preloader-keyframes";
        if (!document.getElementById(id)) {
            const style = document.createElement("style");
            style.id = id;
            style.textContent = `
                @keyframes pl-drawLine {
                    from { transform: scaleX(0); }
                    to { transform: scaleX(1); }
                }
                @keyframes pl-floatUp {
                    0% { opacity: 0; transform: translateY(0) rotate(0deg); }
                    15% { opacity: 0.6; }
                    85% { opacity: 0.15; }
                    100% { opacity: 0; transform: translateY(-100vh) rotate(15deg); }
                }
                @keyframes pl-bgPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        return () => { document.getElementById(id)?.remove(); };
    }, []);

    const root: CSSProperties = {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090b",
        overflow: "hidden",
    };

    const bg: CSSProperties = {
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, rgba(20,184,166,0.06) 0%, transparent 70%)",
        animation: "pl-bgPulse 3s ease-in-out infinite",
    };

    const staffContainer: CSSProperties = {
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 200,
        opacity: 0.12,
    };

    const notesContainer: CSSProperties = {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 500ms ease",
    };

    const logoContainer: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        zIndex: 1,
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "translateY(0) scale(1)" : "translateY(10px) scale(0.96)",
        transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)",
    };

    const iconBox: CSSProperties = {
        width: 72,
        height: 72,
        borderRadius: 20,
        background: "rgba(20,184,166,0.08)",
        border: "1px solid rgba(20,184,166,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(8px)",
    };

    const waveContainer: CSSProperties = {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? "translateY(0)" : "translateY(20px)",
        transition: "all 800ms ease",
    };

    return (
        <div style={root}>
            <div style={bg} />

            {/* Staff Lines */}
            <div style={staffContainer}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        style={{
                            height: 1,
                            background: "linear-gradient(90deg, transparent, #14b8a6, transparent)",
                            animation: `pl-drawLine 600ms ease-out ${i * 80}ms forwards`,
                            transform: "scaleX(0)",
                        }}
                    />
                ))}
            </div>

            {/* Notes */}
            <div style={notesContainer}>
                {NOTES.map((note, i) => (
                    <div
                        key={i}
                        style={{
                            position: "absolute",
                            bottom: -20,
                            left: note.x,
                            fontSize: 18,
                            opacity: 0,
                            color: "rgba(20,184,166,0.25)",
                            animation: `pl-floatUp ${note.duration}ms ease-out ${note.delay}ms infinite`,
                        }}
                    >
                        {note.symbol}
                    </div>
                ))}
            </div>

            {/* Logo */}
            <div style={logoContainer}>
                <div style={iconBox}>
                    <span style={{ fontSize: 44, color: "#14b8a6", lineHeight: 1, fontFamily: "serif" }}>
                        𝄞
                    </span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#fafafa", letterSpacing: "-0.02em" }}>
                    MyChoir
                </span>
                <span style={{ fontSize: 13, color: "rgba(250,250,250,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Хоровий репертуар
                </span>
            </div>

            {/* Wave */}
            <div style={waveContainer}>
                <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                    <path
                        d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z"
                        fill="rgba(20,184,166,0.05)"
                    />
                </svg>
            </div>
        </div>
    );
}

const NOTES = [
    { x: "10%", delay: 0, duration: 2800, symbol: "♪" },
    { x: "25%", delay: 400, duration: 3200, symbol: "♫" },
    { x: "42%", delay: 200, duration: 2600, symbol: "♩" },
    { x: "58%", delay: 600, duration: 3000, symbol: "♪" },
    { x: "73%", delay: 100, duration: 2900, symbol: "♫" },
    { x: "88%", delay: 500, duration: 3100, symbol: "♩" },
    { x: "15%", delay: 800, duration: 2700, symbol: "♪" },
    { x: "65%", delay: 300, duration: 3300, symbol: "♫" },
];
