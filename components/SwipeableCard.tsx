"use client";

import { useState, useRef, ReactNode } from "react";
import { Trash2 } from "lucide-react";

interface SwipeableCardProps {
    children: ReactNode;
    onDelete: () => void;
    disabled?: boolean;
    className?: string; // Outer wrapper class
    contentClassName?: string; // Inner content class (for background overrides)
}

export default function SwipeableCard({ children, onDelete, disabled = false, className = "", contentClassName = "bg-surface" }: SwipeableCardProps) {
    const [translateX, setTranslateX] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);
    const shouldBlockClick = useRef(false);

    const THRESHOLD = 80; // Pixels to reveal delete button
    const DELETE_AREA_WIDTH = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        startX.current = e.touches[0].clientX;
        currentX.current = translateX;
        shouldBlockClick.current = false; // Reset
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (disabled) return;

        const diff = e.touches[0].clientX - startX.current;

        // If we haven't started dragging yet
        if (!isDragging.current) {
            if (Math.abs(diff) > 10) {
                isDragging.current = true;
                shouldBlockClick.current = true; // We are dragging, so block subsequent click
            } else {
                return;
            }
        }

        let newX = currentX.current + diff;
        newX = Math.min(0, Math.max(-DELETE_AREA_WIDTH, newX));
        setTranslateX(newX);
    };

    const handleTouchEnd = () => {
        if (disabled) return;

        if (!isDragging.current) {
            return;
        }

        isDragging.current = false;

        if (Math.abs(translateX) > THRESHOLD / 2) {
            setTranslateX(-DELETE_AREA_WIDTH);
            setIsRevealed(true);
            shouldBlockClick.current = true; // Keep blocked if revealed
        } else {
            setTranslateX(0);
            setIsRevealed(false);
            // If we swiped but cancelled, we still want to block the click that comes immediately
            // setTimeout(() => shouldBlockClick.current = false, 100); 
            // Actually, keep it true for this event loop.
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        startX.current = e.clientX;
        currentX.current = translateX;
        isDragging.current = true;
        shouldBlockClick.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || disabled) return;

        const diff = e.clientX - startX.current;
        if (Math.abs(diff) > 5) shouldBlockClick.current = true;

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

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setTranslateX(0);
        setIsRevealed(false);
    };

    // Intercept clicks to prevent navigation if we just swiped
    const handleClickCapture = (e: React.MouseEvent) => {
        if (shouldBlockClick.current) {
            e.stopPropagation();
            e.preventDefault();
            shouldBlockClick.current = false; // Reset for next time
            return;
        }

        // Also if revealed, close it on click instead of navigating
        /* 
           Ideally we want: click on content -> if revealed, close. else navigate.
           But navigation happens in child onClick.
        */
        if (isRevealed) {
            e.stopPropagation();
            e.preventDefault();
            setTranslateX(0);
            setIsRevealed(false);
        }
    };

    return (
        <div
            className={`relative overflow-hidden ${className}`}
            onClickCapture={handleClickCapture}
        >
            {/* Delete button behind */}
            <div
                className="absolute inset-0 flex items-center justify-end pr-6 bg-red-500 rounded-2xl cursor-pointer active:bg-red-600"
                onClick={handleDeleteClick}
            >
                <div className="flex items-center justify-center text-white">
                    <Trash2 className="w-6 h-6" />
                </div>
            </div>

            {/* Main content */}
            <div
                className={`relative w-full h-full select-none ${contentClassName}`}
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
                    touchAction: 'pan-y'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDragStart={(e) => e.preventDefault()}
            >
                {children}
            </div>
        </div>
    );
}
