"use client";

import { useState, useRef, ReactNode } from "react";
import { Trash2 } from "lucide-react";

interface SwipeableCardProps {
    children: ReactNode;
    onDelete: () => void;
    disabled?: boolean;
    className?: string; // Outer wrapper class
    contentClassName?: string; // Inner content class (for background overrides)
    backgroundClassName?: string; // Delete button background class
}

export default function SwipeableCard({ children, onDelete, disabled = false, className = "", contentClassName = "bg-surface", backgroundClassName = "" }: SwipeableCardProps) {
    const [translateX, setTranslateX] = useState(0);
    // ... existing hook logic ...
    return (
        <div
            className={`relative overflow-hidden isolate ${className}`}
            onClickCapture={handleClickCapture}
            style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }} // Force Safari clipping
        >
            {/* Delete button behind */}
            <div
                className={`absolute inset-0 flex items-center justify-end pr-6 bg-red-500 cursor-pointer active:bg-red-600 ${backgroundClassName}`}
                style={{
                    visibility: translateX < 0 ? 'visible' : 'hidden', // Hide when not swiping to prevent bleed
                    // No opacity transition to keep it "solid"
                }}
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
