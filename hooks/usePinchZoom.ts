"use client";

import { useRef, useState, useCallback } from 'react';

interface PinchZoomState {
    scale: number;
    translateX: number;
    translateY: number;
}

interface UsePinchZoomOptions {
    minScale?: number;
    maxScale?: number;
    enabled?: boolean;
    onScaleChange?: (scale: number) => void;
}

export function usePinchZoom({
    minScale = 1,
    maxScale = 4,
    enabled = true,
    onScaleChange
}: UsePinchZoomOptions = {}) {
    const [state, setState] = useState<PinchZoomState>({
        scale: 1,
        translateX: 0,
        translateY: 0
    });

    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1);

    // Panning refs
    const lastPan = useRef<{ x: number, y: number } | null>(null);

    const getDistance = (touches: TouchList): number => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;

        if (e.touches.length === 2) {
            e.preventDefault();
            e.stopPropagation();
            const touches = e.touches as unknown as TouchList;
            initialDistance.current = getDistance(touches);
            initialScale.current = state.scale;
        } else if (e.touches.length === 1 && state.scale > 1) {
            // Start panning
            lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, [enabled, state.scale]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;

        if (e.touches.length === 2 && initialDistance.current) {
            e.preventDefault();
            e.stopPropagation();

            const touches = e.touches as unknown as TouchList;
            const currentDistance = getDistance(touches);

            // Calculate new scale
            let newScale = initialScale.current * (currentDistance / initialDistance.current);
            newScale = Math.min(maxScale, Math.max(minScale, newScale));

            if (Math.abs(newScale - state.scale) > 0.01) {
                setState(prev => ({
                    ...prev,
                    scale: newScale,
                    // Center the zoom slightly better or keep current pan
                }));
                onScaleChange?.(newScale);
            }
        } else if (e.touches.length === 1 && state.scale > 1 && lastPan.current) {
            // Panning logic
            e.preventDefault();
            e.stopPropagation();

            const dx = e.touches[0].clientX - lastPan.current.x;
            const dy = e.touches[0].clientY - lastPan.current.y;

            setState(prev => ({
                ...prev,
                translateX: prev.translateX + dx,
                translateY: prev.translateY + dy
            }));

            lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, [enabled, state.scale, minScale, maxScale, onScaleChange]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (e.touches.length < 2) {
            initialDistance.current = null;
        }
        if (e.touches.length === 0) {
            lastPan.current = null;
        }
    }, []);

    const resetZoom = useCallback(() => {
        setState({ scale: 1, translateX: 0, translateY: 0 });
        onScaleChange?.(1);
    }, [onScaleChange]);

    const zoomIn = useCallback(() => {
        setState(prev => ({
            ...prev,
            scale: Math.min(maxScale, prev.scale * 1.5)
        }));
    }, [maxScale]);

    const zoomOut = useCallback(() => {
        const newScale = Math.max(minScale, state.scale / 1.5);
        setState(prev => ({
            ...prev,
            scale: newScale,
            translateX: newScale <= 1 ? 0 : prev.translateX,
            translateY: newScale <= 1 ? 0 : prev.translateY
        }));
    }, [minScale]);

    return {
        scale: state.scale,
        translateX: state.translateX,
        translateY: state.translateY,
        isPinching: false, // Simplified
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
        resetZoom,
        zoomIn,
        zoomOut,
        style: {
            transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
            transformOrigin: '0 0', // Important: zoom from top-left, handle positioning via translate
            transition: state.scale === 1 ? 'transform 0.3s ease' : 'none'
        }
    };
}
