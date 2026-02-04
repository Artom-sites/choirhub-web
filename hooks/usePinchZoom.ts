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
    const lastTouchEnd = useRef<number>(0);
    const touchCount = useRef<number>(0);

    const getDistance = (touches: TouchList): number => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;

        touchCount.current = e.touches.length;

        if (e.touches.length === 2) {
            e.preventDefault();
            e.stopPropagation();
            const touches = e.touches as unknown as TouchList;
            initialDistance.current = getDistance(touches);
            initialScale.current = state.scale;
        }
    }, [enabled, state.scale]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;

        touchCount.current = e.touches.length;

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
                    translateX: newScale <= 1 ? 0 : prev.translateX,
                    translateY: newScale <= 1 ? 0 : prev.translateY
                }));
                onScaleChange?.(newScale);
            }
        }
    }, [enabled, state.scale, minScale, maxScale, onScaleChange]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        touchCount.current = e.touches.length;

        if (e.touches.length < 2) {
            initialDistance.current = null;
        }

        // Double-tap to reset zoom - only when all fingers lifted
        if (e.touches.length === 0 && e.changedTouches.length === 1) {
            const now = Date.now();
            if (now - lastTouchEnd.current < 300 && state.scale > 1.1) {
                setState({ scale: 1, translateX: 0, translateY: 0 });
                onScaleChange?.(1);
            }
            lastTouchEnd.current = now;
        }
    }, [onScaleChange, state.scale]);

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
        setState({
            scale: newScale,
            translateX: newScale <= 1 ? 0 : state.translateX,
            translateY: newScale <= 1 ? 0 : state.translateY
        });
    }, [minScale, state]);

    return {
        scale: state.scale,
        translateX: state.translateX,
        translateY: state.translateY,
        isPinching: touchCount.current >= 2,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
        resetZoom,
        zoomIn,
        zoomOut,
        style: {
            transform: `scale(${state.scale})`,
            transformOrigin: 'center top',
        }
    };
}
