"use client";

import { useRef, useState, useCallback, useEffect } from 'react';

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
    const initialCenter = useRef<{ x: number; y: number } | null>(null);
    const lastTouchEnd = useRef<number>(0);
    const isPinching = useRef<boolean>(false);

    const getDistance = (touches: TouchList): number => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getCenter = (touches: TouchList): { x: number; y: number } => {
        if (touches.length < 2) {
            return { x: touches[0].clientX, y: touches[0].clientY };
        }
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;

        if (e.touches.length === 2) {
            e.preventDefault();
            isPinching.current = true;
            const touches = e.touches as unknown as TouchList;
            initialDistance.current = getDistance(touches);
            initialScale.current = state.scale;
            initialCenter.current = getCenter(touches);
        }
    }, [enabled, state.scale]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!enabled || !isPinching.current) return;

        if (e.touches.length === 2 && initialDistance.current) {
            e.preventDefault();

            const touches = e.touches as unknown as TouchList;
            const currentDistance = getDistance(touches);
            const currentCenter = getCenter(touches);

            // Calculate new scale
            let newScale = initialScale.current * (currentDistance / initialDistance.current);
            newScale = Math.min(maxScale, Math.max(minScale, newScale));

            // Calculate translation to zoom toward pinch center
            let newTranslateX = state.translateX;
            let newTranslateY = state.translateY;

            if (initialCenter.current && newScale !== state.scale) {
                const scaleDiff = newScale / state.scale;

                // Adjust translation based on zoom center
                newTranslateX = currentCenter.x - (currentCenter.x - state.translateX) * scaleDiff;
                newTranslateY = currentCenter.y - (currentCenter.y - state.translateY) * scaleDiff;
            }

            // Keep translations bounded
            if (newScale <= 1) {
                newTranslateX = 0;
                newTranslateY = 0;
            }

            setState({
                scale: newScale,
                translateX: newTranslateX,
                translateY: newTranslateY
            });

            onScaleChange?.(newScale);
        }
    }, [enabled, state, minScale, maxScale, onScaleChange]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (e.touches.length < 2) {
            isPinching.current = false;
            initialDistance.current = null;
            initialCenter.current = null;
        }

        // Double-tap to reset zoom
        const now = Date.now();
        if (now - lastTouchEnd.current < 300 && e.changedTouches.length === 1) {
            setState({ scale: 1, translateX: 0, translateY: 0 });
            onScaleChange?.(1);
        }
        lastTouchEnd.current = now;
    }, [onScaleChange]);

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
        isPinching: isPinching.current,
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
            transition: isPinching.current ? 'none' : 'transform 0.1s ease-out'
        }
    };
}
