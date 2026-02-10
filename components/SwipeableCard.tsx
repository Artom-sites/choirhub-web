"use client";

import { useState, useRef, ReactNode } from "react";
import { Trash2 } from "lucide-react";

interface SwipeableCardProps {
    children: ReactNode;
    onDelete: () => void;
    disabled?: boolean;
    className?: string;
}

export default function SwipeableCard({ children, onDelete, disabled = false, className = "" }: SwipeableCardProps) {
    const [translateX, setTranslateX] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);

    const THRESHOLD = 80; // Pixels to reveal delete button
    const DELETE_AREA_WIDTH = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        startX.current = e.touches[0].clientX;
        currentX.current = translateX;
        // Don't set isDragging true yet, wait for move
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (disabled) return;

        const diff = e.touches[0].clientX - startX.current;

        // If we haven't started dragging yet
        if (!isDragging.current) {
            // Check if horizontal swipe is intended (threshold)
            if (Math.abs(diff) > 10) {
                isDragging.current = true;
            } else {
                // If moving less than 10px, treat as potential scroll or click, do nothing yet
                return;
            }
        }

        let newX = currentX.current + diff;
        // Limit swipe logic
        newX = Math.min(0, Math.max(-DELETE_AREA_WIDTH, newX));
        setTranslateX(newX);
    };

    const handleTouchEnd = () => {
        if (disabled) return;

        if (!isDragging.current) {
            // It was a tap or vertical scroll, didn't trigger swipe
            // Reset just in case, but don't prevent click
            return;
        }

        isDragging.current = false;

        if (Math.abs(translateX) > THRESHOLD / 2) {
            setTranslateX(-DELETE_AREA_WIDTH);
            setIsRevealed(true);
        } else {
            setTranslateX(0);
            setIsRevealed(false);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        startX.current = e.clientX;
        currentX.current = translateX;
        isDragging.current = true;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || disabled) return;

        const diff = e.clientX - startX.current;
        let newX = currentX.current + diff;

        newX = Math.min(0, Math.max(-DELETE_AREA_WIDTH, newX));
        setTranslateX(newX);
    };

    const handleMouseUp = () => {
        if (!isDragging.current || disabled) return;
        isDragging.current = false;

        if (Math.abs(translateX) > THRESHOLD / 2) {
            setTranslateX(-DELETE_AREA_WIDTH);
            setIsRevealed(true);
        } else {
            setTranslateX(0);
            setIsRevealed(false);
        }
    };

    const handleMouseLeave = () => {
        if (isDragging.current) {
            handleMouseUp();
        }
    };

    const handleDeleteClick = () => {
        onDelete();
        // Reset after delete
        setTranslateX(0);
        setIsRevealed(false);
    };

    const resetSwipe = () => {
        setTranslateX(0);
        setIsRevealed(false);
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Delete button behind */}
            <div
                className="absolute inset-0 flex items-center justify-end pr-6 bg-red-500 rounded-2xl transition-opacity cursor-pointer active:bg-red-600"
                style={{ opacity: Math.abs(translateX) / DELETE_AREA_WIDTH }}
                onClick={handleDeleteClick}
            >
                <div className="flex items-center justify-center text-white">
                    <Trash2 className="w-6 h-6" />
                </div>
            </div>

            {/* Main content */}
            <div
                className="relative transition-transform"
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.2s ease-out'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </div>
        </div>
    );
}
