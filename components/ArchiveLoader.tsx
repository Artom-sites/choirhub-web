"use client";

import { motion } from "framer-motion";
import { Music } from "lucide-react";

/**
 * Archive Loader - Musical Note with Sound Waves
 * Design: A musical note icon in the center with expanding sound wave rings.
 * Used specifically for loading the song archive.
 */
export default function ArchiveLoader() {
    return (
        <div className="flex items-center justify-center py-20">
            <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Sound wave rings expanding outward */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute border-2 border-white/20 rounded-full"
                        initial={{ width: 48, height: 48, opacity: 0.5 }}
                        animate={{
                            width: [48, 128],
                            height: [48, 128],
                            opacity: [0.5, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.6,
                            ease: "easeOut",
                        }}
                    />
                ))}

                {/* Central music note icon */}
                <motion.div
                    className="relative z-10 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20"
                    animate={{
                        scale: [1, 1.1, 1],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <Music className="w-6 h-6 text-white/80" />
                </motion.div>
            </div>
        </div>
    );
}
