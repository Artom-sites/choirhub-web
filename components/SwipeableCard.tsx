"use client";

import { useState, useEffect, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { motion, useAnimation, PanInfo, useMotionValue, useTransform } from "framer-motion";

interface SwipeableCardProps {
    children: ReactNode;
    onDelete: () => void;
    disabled?: boolean;
    className?: string; // Outer wrapper class
    contentClassName?: string; // Inner content class (for background overrides)
}

export default function SwipeableCard({ children, onDelete, disabled = false, className = "", contentClassName = "bg-surface" }: SwipeableCardProps) {
    const controls = useAnimation();
    const x = useMotionValue(0);
    const [isOpen, setIsOpen] = useState(false);
    const DELETE_AREA_WIDTH = 80;
    const THRESHOLD = 40;

    // Transform x to opacity/scale for the icon
    // Map -80 to 1, 0 to 0. Limit to 0-1 range.
    const iconOpacity = useTransform(x, [-DELETE_AREA_WIDTH, 0], [1, 0]);
    const iconScale = useTransform(x, [-DELETE_AREA_WIDTH, 0], [1, 0.5]);

    useEffect(() => {
        if (disabled && isOpen) {
            controls.start({ x: 0 });
            setIsOpen(false);
        }
    }, [disabled, isOpen, controls]);

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (offset < -THRESHOLD || velocity < -500) {
            await controls.start({ x: -DELETE_AREA_WIDTH });
            setIsOpen(true);
        } else {
            await controls.start({ x: 0 });
            setIsOpen(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        controls.start({ x: 0 });
        setIsOpen(false);
    };

    const handleContentClick = (e: React.MouseEvent) => {
        if (isOpen) {
            e.stopPropagation();
            e.preventDefault(); // Stop navigation
            controls.start({ x: 0 });
            setIsOpen(false);
        }
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Delete button layer (behind) */}
            <div
                className="absolute inset-0 flex items-center justify-end pr-6 bg-red-500 rounded-lg transition-colors active:bg-red-600 cursor-pointer"
                onClick={handleDeleteClick}
            >
                <motion.div
                    style={{ opacity: iconOpacity, scale: iconScale }}
                    className="flex items-center justify-center text-white"
                >
                    <Trash2 className="w-6 h-6" />
                </motion.div>
            </div>

            {/* Draggable Main content */}
            <motion.div
                className={`relative w-full h-full ${contentClassName}`}
                style={{ x, touchAction: "pan-y" }}
                drag={disabled ? false : "x"}
                dragConstraints={{ left: -DELETE_AREA_WIDTH, right: 0 }}
                dragElastic={0.1}
                animate={controls}
                onDragEnd={handleDragEnd}
                onClickCapture={handleContentClick}
            >
                {children}
            </motion.div>
        </div>
    );
}
