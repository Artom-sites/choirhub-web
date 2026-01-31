"use client";

import { motion } from "framer-motion";

/**
 * Concentric Ripples Preloader
 * Design: Three thin white rings that smoothly expand from center and fade out.
 * Metaphor: Sound spreading from source (like singing), vibration, resonance.
 * Clean, minimalist, no distracting elements.
 */
export default function Preloader() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Three concentric ripple rings */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute border border-white/40 rounded-full"
                        initial={{ width: 16, height: 16, opacity: 0.6 }}
                        animate={{
                            width: [16, 128],
                            height: [16, 128],
                            opacity: [0.6, 0],
                        }}
                        transition={{
                            duration: 2.4,
                            repeat: Infinity,
                            delay: i * 0.8,
                            ease: "easeOut",
                        }}
                    />
                ))}

                {/* Small center dot for visual anchor */}
                <div className="w-2 h-2 bg-white/30 rounded-full" />
            </div>
        </div>
    );
}
