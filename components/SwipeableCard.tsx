"use client";

import { useState, useRef, forwardRef, useImperativeHandle, ReactNode } from "react";
import { Trash2 } from "lucide-react";

export interface SwipeableCardRef {
    reset: () => void;
}

interface SwipeableCardProps {
    children: ReactNode;
    onDelete: () => void;
    disabled?: boolean;
    className?: string; // Outer wrapper class
    contentClassName?: string; // Inner content class (for background overrides)
    backgroundClassName?: string; // Delete button background class
    disableFullSwipe?: boolean;
}

const SwipeableCard = forwardRef<SwipeableCardRef, SwipeableCardProps>(({
    children,
    onDelete,
    disabled = false,
    className = "",
    contentClassName = "bg-surface",
    backgroundClassName = "",
    disableFullSwipe = false
}, ref) => {
    const [translateX, setTranslateX] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);
    const shouldBlockClick = useRef(false);

    useImperativeHandle(ref, () => ({
        reset: () => {
            setTranslateX(0);
            setIsRevealed(false);
            shouldBlockClick.current = false;
        }
    }));

    const THRESHOLD = 80; // Pixels to reveal delete button
    const DELETE_AREA_WIDTH = 80; // Standard reveal width
    const TRIGGER_THRESHOLD = 180; // Distance to trigger instant delete

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
        // Allow dragging past DELETE_AREA_WIDTH up to TRIGGER_THRESHOLD + overshoot
        // Add resistance past TRIGGER_THRESHOLD? For now just allow it.
        newX = Math.min(0, newX);

        // If full swipe is disabled, limit the drag to just a bit past the reveal width
        if (disableFullSwipe && newX < -(DELETE_AREA_WIDTH + 50)) {
            // Add resistance or hard stop
            newX = -(DELETE_AREA_WIDTH + 50) + (newX + (DELETE_AREA_WIDTH + 50)) * 0.2;
        }

        setTranslateX(newX);
    };

    const handleTouchEnd = () => {
        if (disabled) return;

        if (!isDragging.current) {
            return;
        }

        isDragging.current = false;
        const absX = Math.abs(translateX);

        if (!disableFullSwipe && absX > TRIGGER_THRESHOLD) {
            // Full swipe delete!
            onDelete();
            setTranslateX(-window.innerWidth);
        } else if (absX > THRESHOLD / 2) {
            setTranslateX(-DELETE_AREA_WIDTH);
            setIsRevealed(true);
            shouldBlockClick.current = true; // Keep blocked if revealed
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
        shouldBlockClick.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || disabled) return;

        const diff = e.clientX - startX.current;
        if (Math.abs(diff) > 5) shouldBlockClick.current = true;

        let newX = currentX.current + diff;
        newX = Math.min(0, newX);

        // If full swipe is disabled, limit the drag
        if (disableFullSwipe && newX < -(DELETE_AREA_WIDTH + 50)) {
            newX = -(DELETE_AREA_WIDTH + 50) + (newX + (DELETE_AREA_WIDTH + 50)) * 0.2;
        }

        setTranslateX(newX);
    };

    const handleMouseUp = () => {
        if (!isDragging.current || disabled) return;
        isDragging.current = false;
        const absX = Math.abs(translateX);

        if (!disableFullSwipe && absX > TRIGGER_THRESHOLD) {
            onDelete();
            setTranslateX(-500); // Visual clear
        } else if (absX > THRESHOLD / 2) {
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
        e.preventDefault();
        onDelete();
        setTranslateX(0);
        setIsRevealed(false);
        shouldBlockClick.current = false;
    };

    // Calculate scale/opacity for visual feedback
    const progress = Math.min(1, Math.max(0, (Math.abs(translateX) - DELETE_AREA_WIDTH) / (TRIGGER_THRESHOLD - DELETE_AREA_WIDTH)));
    const iconScale = disableFullSwipe ? 1 : 1 + progress * 0.5; // Scale from 1.0 to 1.5

    // Intercept clicks to prevent navigation if we just swiped
    const handleClickCapture = (e: React.MouseEvent) => {
        // ALWAYS let delete button clicks through first
        if ((e.target as HTMLElement).closest('[data-delete-action="true"]')) {
            shouldBlockClick.current = false;
            return; // Let the delete click happen!
        }

        if (shouldBlockClick.current) {
            e.stopPropagation();
            e.preventDefault();
            shouldBlockClick.current = false;
            return;
        }

        // If revealed, close it on click instead of navigating
        if (isRevealed) {
            e.stopPropagation();
            e.preventDefault();
            setTranslateX(0);
            setIsRevealed(false);
        }
    };

    return (
        <div
            className={`relative overflow-hidden ${className} ${backgroundClassName}`}
            onClickCapture={handleClickCapture}
        >
            {/* Delete action — strictly bound to card height */}
            <div
                data-delete-action="true"
                className={`bg-red-500 cursor-pointer active:bg-red-600 absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6 transition-opacity duration-200`}
                style={{
                    visibility: translateX < 0 ? 'visible' : 'hidden',
                    touchAction: 'manipulation',
                }}
                onClick={handleDeleteClick}
                onTouchEnd={(e) => {
                    if (isRevealed) {
                        e.stopPropagation();
                        onDelete();
                        // Reset everything
                        setTranslateX(0);
                        setIsRevealed(false);
                        shouldBlockClick.current = false;
                    }
                }}
            >
                <div
                    className="flex items-center justify-center text-white transition-transform duration-75"
                    style={{
                        transform: `scale(${iconScale})`,
                        opacity: 1
                    }}
                >
                    <Trash2 className="w-6 h-6" />
                </div>
            </div>

            {/* Swipe content — relative z-1, defines card height */}
            <div
                className={`w-full h-full select-none ${contentClassName}`}
                style={{
                    position: 'relative',
                    zIndex: 1,
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
});

export default SwipeableCard;
