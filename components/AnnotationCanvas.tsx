"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { ToolType, EraserSize } from './AnnotationToolbar';

interface AnnotationCanvasProps {
    pageNumber: number;
    pdfUrl: string; // Used as key for storage
    width: number;
    height: number;
    activeTool: ToolType;
    color: string;
    eraserSize: EraserSize;
    onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
    triggerClear: number; // Increment to trigger clear
    triggerUndo: number; // Increment to trigger undo
    triggerRedo: number; // Increment to trigger redo
}

interface Point {
    x: number;
    y: number;
    pressure?: number;
}

interface Stroke {
    tool: ToolType;
    color: string;
    width: number;
    points: Point[]; // Normalized 0..1
}

// Eraser size multipliers
const ERASER_WIDTH_MAP: Record<EraserSize, number> = {
    small: 0.015,
    medium: 0.03,
    large: 0.06,
};

export default function AnnotationCanvas({
    pageNumber,
    pdfUrl,
    width,
    height,
    activeTool,
    color,
    eraserSize,
    onHistoryChange,
    triggerClear,
    triggerUndo,
    triggerRedo
}: AnnotationCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStack, setRedoStack] = useState<Stroke[]>([]);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Track active touches for multi-touch detection
    const activeTouchesRef = useRef<number>(0);
    const lastPointRef = useRef<Point | null>(null);

    // Storage Key: unique per PDF and Page
    const storageKey = `annotations_${btoa(pdfUrl).slice(0, 32)}_p${pageNumber}`;

    // Load from storage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                setStrokes(parsed);
                // Clear redo stack on load
                setRedoStack([]);
            }
        } catch (e) {
            console.error("Failed to load annotations", e);
        }
    }, [storageKey]);

    // Save to storage
    useEffect(() => {
        if (strokes.length > 0) {
            try {
                // Simplify or compress if needed, for now raw JSON
                localStorage.setItem(storageKey, JSON.stringify(strokes));
            } catch (e) {
                console.error("Storage limit reached?", e);
            }
        } else {
            // If empty, remove key to save space
            localStorage.removeItem(storageKey);
        }

        // Notify parent about history state
        onHistoryChange(strokes.length > 0, redoStack.length > 0);
    }, [strokes, redoStack, storageKey, onHistoryChange]);

    // Handle External Triggers
    useEffect(() => {
        if (triggerClear > 0) {
            setStrokes([]);
            setRedoStack([]);
        }
    }, [triggerClear]);

    // Track previous trigger values with refs to avoid running on first mount
    const prevUndoRef = useRef(triggerUndo);
    const prevRedoRef = useRef(triggerRedo);
    // Store latest state in refs for access inside effects
    const strokesRef = useRef(strokes);
    const redoStackRef = useRef(redoStack);

    // Keep refs updated
    useEffect(() => {
        strokesRef.current = strokes;
    }, [strokes]);

    useEffect(() => {
        redoStackRef.current = redoStack;
    }, [redoStack]);

    useEffect(() => {
        if (triggerUndo !== prevUndoRef.current) {
            prevUndoRef.current = triggerUndo;
            const currentStrokes = strokesRef.current;
            if (currentStrokes.length > 0) {
                const newStrokes = [...currentStrokes];
                const removed = newStrokes.pop();
                if (removed) {
                    setStrokes(newStrokes);
                    setRedoStack(prev => [...prev, removed]);
                }
            }
        }
    }, [triggerUndo]);

    useEffect(() => {
        if (triggerRedo !== prevRedoRef.current) {
            prevRedoRef.current = triggerRedo;
            const currentRedo = redoStackRef.current;
            if (currentRedo.length > 0) {
                const newRedo = [...currentRedo];
                const toRestore = newRedo.pop();
                if (toRestore) {
                    setStrokes(prev => [...prev, toRestore]);
                    setRedoStack(newRedo);
                }
            }
        }
    }, [triggerRedo]);

    // Catmull-Rom spline interpolation for smoother lines
    const interpolatePoints = (points: Point[], tension: number = 0.5): Point[] => {
        if (points.length < 3) return points;

        const result: Point[] = [];
        result.push(points[0]);

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[Math.min(points.length - 1, i + 1)];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            // Add intermediate points
            for (let t = 0; t <= 1; t += 0.2) {
                if (t === 0) continue;

                const t2 = t * t;
                const t3 = t2 * t;

                const x = 0.5 * (
                    (2 * p1.x) +
                    (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
                );

                const y = 0.5 * (
                    (2 * p1.y) +
                    (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
                );

                result.push({ x, y });
            }
        }

        result.push(points[points.length - 1]);
        return result;
    };

    // Drawing Logic (Rendering)
    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, smooth: boolean = true) => {
        if (stroke.points.length < 2) return;

        // Apply smoothing for final render
        const points = smooth && stroke.points.length > 3
            ? interpolatePoints(stroke.points)
            : stroke.points;

        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;

        if (stroke.tool === 'marker') {
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = stroke.width * width * 3;
            ctx.globalCompositeOperation = 'multiply';
        } else if (stroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = stroke.width * width;
            ctx.globalAlpha = 1;
        } else {
            // Pen
            ctx.globalAlpha = 1;
            ctx.lineWidth = stroke.width * width;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Draw path
        ctx.beginPath();
        const first = points[0];
        ctx.moveTo(first.x * width, first.y * height);

        // Smoothing using quadratic curves
        let i = 0;
        for (i = 1; i < points.length - 2; i++) {
            const c = (points[i].x * width);
            const d = (points[i].y * height);
            const e = (points[i + 1].x * width);
            const f = (points[i + 1].y * height);

            // Midpoint
            const midX = (c + e) / 2;
            const midY = (d + f) / 2;

            ctx.quadraticCurveTo(c, d, midX, midY);
        }

        // Last few points
        for (; i < points.length; i++) {
            const p = points[i];
            ctx.lineTo(p.x * width, p.y * height);
        }

        ctx.stroke();
    };

    // Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use round cap/join for smoother strokes
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw all saved strokes with smoothing
        strokes.forEach(s => drawStroke(ctx, s, true));

        // Draw current stroke being drawn (without smoothing for responsiveness)
        if (currentStroke) {
            drawStroke(ctx, currentStroke, false);
        }

    }, [strokes, currentStroke, width, height]);


    // Event Handlers
    const getPoint = (e: React.PointerEvent): Point => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            x: Number(((e.clientX - rect.left) / rect.width).toFixed(5)), // Use rect.width (visual)
            y: Number(((e.clientY - rect.top) / rect.height).toFixed(5)), // Use rect.height (visual)
            pressure: e.pressure
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Track number of active touches
        activeTouchesRef.current++;

        // If more than one touch, likely pinch-to-zoom - don't draw
        if (activeTouchesRef.current > 1) {
            // Cancel any current drawing
            if (isDrawing) {
                setIsDrawing(false);
                setCurrentStroke(null);
            }
            return;
        }

        e.preventDefault(); // Prevent scrolling only for single touch
        if (activeTool === 'none' as ToolType) return;

        canvasRef.current?.setPointerCapture(e.pointerId);
        setIsDrawing(true);

        const startPoint = getPoint(e);
        lastPointRef.current = startPoint;

        const strokeWidth = activeTool === 'eraser'
            ? ERASER_WIDTH_MAP[eraserSize]
            : activeTool === 'pen' ? 0.003 : 0.02;

        setCurrentStroke({
            tool: activeTool,
            color: activeTool === 'eraser' ? '#000000' : color,
            width: strokeWidth,
            points: [startPoint]
        });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // Always track cursor for eraser indicator
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }

        // Don't draw if multiple touches or not in drawing mode
        if (activeTouchesRef.current > 1 || !isDrawing || !currentStroke) return;
        e.preventDefault();

        const point = getPoint(e);

        // Add point thinning - skip if too close to last point
        const lastPoint = lastPointRef.current;
        if (lastPoint) {
            const dx = point.x - lastPoint.x;
            const dy = point.y - lastPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Skip if distance is too small (reduces jitter)
            if (dist < 0.002) return;
        }

        lastPointRef.current = point;

        setCurrentStroke(prev => ({
            ...prev!,
            points: [...prev!.points, point]
        }));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        activeTouchesRef.current = Math.max(0, activeTouchesRef.current - 1);

        if (!isDrawing || !currentStroke) return;

        canvasRef.current?.releasePointerCapture(e.pointerId);
        setIsDrawing(false);
        lastPointRef.current = null;

        // Only save if we have enough points
        if (currentStroke.points.length >= 2) {
            setStrokes(prev => [...prev, currentStroke]);
            setRedoStack([]); // Clear redo on new action
        }
        setCurrentStroke(null);
    };

    const eraserDisplaySize = ERASER_WIDTH_MAP[eraserSize] * width;

    return (
        <>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="absolute inset-0 z-20"
                style={{
                    width,
                    height,
                    cursor: activeTool === 'eraser' ? 'none' : 'crosshair',
                    touchAction: 'none' // Let JS handle all touch
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={(e) => { handlePointerUp(e); setCursorPos(null); }}
                onPointerCancel={(e) => { handlePointerUp(e); setCursorPos(null); }}
            />
            {/* Eraser cursor indicator */}
            {activeTool === 'eraser' && cursorPos && (
                <div
                    className="absolute pointer-events-none z-30 rounded-full border-2 border-gray-800 bg-white/30"
                    style={{
                        width: eraserDisplaySize,
                        height: eraserDisplaySize,
                        left: cursorPos.x - eraserDisplaySize / 2,
                        top: cursorPos.y - eraserDisplaySize / 2,
                    }}
                />
            )}
        </>
    );
}
