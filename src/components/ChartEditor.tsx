import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ChartState, Note } from '../types';

interface ChartEditorProps {
    state: ChartState;
    audioBuffer: AudioBuffer | null;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    onAddNote: (note: Note) => void;
    onRemoveNote: (id: string) => void;
    playHitSound: () => void;
}

const PIXELS_PER_SECOND = 200; // Base zoom level
const LANE_WIDTH = 60;
const LEFT_PADDING = 80;

export function ChartEditor({
    state,
    audioBuffer,
    currentTime,
    duration,
    isPlaying,
    onAddNote,
    onRemoveNote,
    playHitSound,
}: ChartEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const zoom = 1; // Used for calculation but not state yet

    // Interactive state
    const [dragStart, setDragStart] = useState<{ lane: number, beat: number } | null>(null);
    const [dragCurrent, setDragCurrent] = useState<{ lane: number, beat: number } | null>(null);
    const lastPlayedTimeRef = useRef<number>(currentTime);

    const totalHeight = Math.max(
        containerRef.current?.clientHeight || 0,
        (duration || 10) * PIXELS_PER_SECOND * zoom
    );

    const drawChart = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !containerRef.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear background
        ctx.fillStyle = '#181b21'; // Tailwind surface color
        ctx.fillRect(0, 0, width, height);

        const secondsPerBeat = 60 / state.bpm;
        const chartAreaWidth = state.lanes * LANE_WIDTH;

        // --- Draw Audio Waveform (Background) ---
        if (audioBuffer) {
            ctx.fillStyle = '#272a30'; // Tailwind border
            const channelData = audioBuffer.getChannelData(0); // Left channel
            // Basic downsampling for waveform display
            const step = Math.ceil(channelData.length / height);

            ctx.beginPath();
            for (let i = 0; i < height; i++) {
                // Find max/min in this step
                let min = 1.0;
                let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const datum = channelData[Math.min((height - i) * step + j, channelData.length - 1)];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }

                // Draw waveform on the left side (padding area)
                const xOffset = LEFT_PADDING / 2;
                const amp = 30; // Max width mapping
                if (i === 0) ctx.moveTo(xOffset + max * amp, i);
                else ctx.lineTo(xOffset + max * amp, i);
            }
            ctx.strokeStyle = '#4f46e5'; // primary-hover
            ctx.lineWidth = 1;
            ctx.stroke();
        }


        // --- Draw Grid ---
        ctx.strokeStyle = '#334155'; // Tailwind slate-700
        ctx.lineWidth = 1;

        // Draw Lanes
        for (let i = 0; i <= state.lanes; i++) {
            const x = LEFT_PADDING + i * LANE_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw Beat Lines
        // The bottom of the canvas is time 0, moving upwards as time increases.
        // However, to keep it simple initially: Top is end, Bottom is start (like standard rhythm games)
        // Actually standard vertically scrolling chart editors often have time 0 at the bottom.

        // Determine visible time range based on scroll
        // For now, let's just map Y coordinates simply: Bottom = 0 seconds
        const totalBeats = (duration || 60) / secondsPerBeat;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Inter';
        ctx.fillStyle = '#94a3b8'; // text-muted

        for (let i = 0; i < totalBeats; i += (1 / state.division)) {
            const isWholeBeat = Number.isInteger(i);
            const isBar = i % 4 === 0; // Assuming 4/4 time for now

            const timeForBeat = i * secondsPerBeat;
            const y = height - (timeForBeat * PIXELS_PER_SECOND * zoom);

            if (y < 0 || y > height) continue; // Culling

            ctx.beginPath();
            ctx.moveTo(LEFT_PADDING, y);
            ctx.lineTo(LEFT_PADDING + chartAreaWidth, y);

            if (isBar) {
                ctx.strokeStyle = '#94a3b8'; // Brighter for bars
                ctx.fillText(`M${Math.floor(i / 4)}`, LEFT_PADDING - 10, y);
            } else if (isWholeBeat) {
                ctx.strokeStyle = '#475569'; // slate-600
                ctx.fillText(i.toString(), LEFT_PADDING - 10, y);
            } else {
                ctx.strokeStyle = '#1e293b'; // slate-800
            }
            ctx.stroke();
        }


        // --- Draw Notes ---
        state.notes.forEach(note => {
            const timeInSeconds = note.beat * secondsPerBeat;
            const yStr = height - (timeInSeconds * PIXELS_PER_SECOND * zoom);
            const x = LEFT_PADDING + note.lane * LANE_WIDTH;

            if (note.type === 'long' && note.duration) {
                const endY = height - ((note.beat + note.duration) * secondsPerBeat * PIXELS_PER_SECOND * zoom);
                // Draw note body (tail)
                ctx.fillStyle = 'rgba(244, 63, 94, 0.4)'; // translucent accent
                ctx.fillRect(x + 10, endY, LANE_WIDTH - 20, yStr - endY);

                // Draw head and end cap
                ctx.fillStyle = '#f43f5e';
                ctx.fillRect(x + 2, endY - 5, LANE_WIDTH - 4, 10);
                ctx.fillRect(x + 2, yStr - 5, LANE_WIDTH - 4, 10);
            } else {
                if (yStr >= 0 && yStr <= height) {
                    // Short note
                    ctx.fillStyle = '#f43f5e'; // Accent color
                    ctx.shadowColor = '#e11d48';
                    ctx.shadowBlur = 10;
                    ctx.fillRect(x + 2, yStr - 5, LANE_WIDTH - 4, 10);
                    ctx.shadowBlur = 0; // Reset
                }
            }
        });

        // --- Draw Drag Ghost ---
        if (dragStart && dragCurrent) {
            const startY = height - (dragStart.beat * secondsPerBeat * PIXELS_PER_SECOND * zoom);
            const minBeat = Math.min(dragStart.beat, dragCurrent.beat);
            const maxBeat = Math.max(dragStart.beat, dragCurrent.beat);
            const len = maxBeat - minBeat;

            const x = LEFT_PADDING + dragStart.lane * LANE_WIDTH;

            if (len > 0) {
                const topY = height - (maxBeat * secondsPerBeat * PIXELS_PER_SECOND * zoom);
                const bottomY = height - (minBeat * secondsPerBeat * PIXELS_PER_SECOND * zoom);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(x + 10, topY, LANE_WIDTH - 20, bottomY - topY);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(x + 2, topY - 5, LANE_WIDTH - 4, 10);
                ctx.fillRect(x + 2, bottomY - 5, LANE_WIDTH - 4, 10);
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(x + 2, startY - 5, LANE_WIDTH - 4, 10);
            }
        }

        // --- Draw Playhead ---
        const currentY = height - (currentTime * PIXELS_PER_SECOND * zoom);
        if (currentY >= 0 && currentY <= height) {
            ctx.beginPath();
            ctx.moveTo(0, currentY);
            ctx.lineTo(width, currentY);
            ctx.strokeStyle = '#22c55e'; // Green playhead
            ctx.lineWidth = 2;
            ctx.stroke();
        }

    }, [state, audioBuffer, duration, currentTime, zoom]);

    // Handle Resize and Animation Loop
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                // Use parent dimensions
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = totalHeight;
                drawChart();
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [totalHeight, drawChart]);

    useEffect(() => {
        let animationId: number;
        const renderLoop = () => {
            drawChart();
            if (isPlaying) {
                // Scroll the container so the playhead stays mostly centered or visible
                if (containerRef.current) {
                    const currentY = totalHeight - (currentTime * PIXELS_PER_SECOND * zoom);
                    // Simple auto-scroll strategy: center playhead
                    const targetScroll = currentY - containerRef.current.clientHeight * 0.75;
                    containerRef.current.scrollTop = targetScroll;
                }
                animationId = requestAnimationFrame(renderLoop);
            }
        };

        if (isPlaying) {
            animationId = requestAnimationFrame(renderLoop);
        } else {
            drawChart();
            lastPlayedTimeRef.current = currentTime; // Reset when paused/stopped
        }

        return () => cancelAnimationFrame(animationId);
    }, [isPlaying, currentTime, drawChart, totalHeight, zoom]);

    // Hit sounds
    useEffect(() => {
        if (!isPlaying) return;

        const secondsPerBeat = 60 / state.bpm;

        state.notes.forEach(note => {
            const timeInSeconds = note.beat * secondsPerBeat;
            // A note is hit if its time falls between the last frame and current frame
            if (timeInSeconds > lastPlayedTimeRef.current && timeInSeconds <= currentTime) {
                playHitSound();
            }
        });

        lastPlayedTimeRef.current = currentTime;
    }, [currentTime, isPlaying, state.notes, state.bpm, playHitSound]);


    // Interaction Handlers
    const getGridPosition = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x < LEFT_PADDING || x > LEFT_PADDING + state.lanes * LANE_WIDTH) return null;

        const lane = Math.floor((x - LEFT_PADDING) / LANE_WIDTH);
        let yFromBottom = canvasRef.current.height - y;

        // Clamp to ensure we don't place notes out of bounds
        yFromBottom = Math.max(0, yFromBottom);

        const timeInSec = yFromBottom / (PIXELS_PER_SECOND * zoom);
        const secondsPerBeat = 60 / state.bpm;
        const rawBeat = timeInSec / secondsPerBeat;
        const beat = Math.round(rawBeat * state.division) / state.division;

        return { lane, beat };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // Deleting a note
        if (e.button === 2) { // Right click
            const pos = getGridPosition(e);
            if (pos) {
                // Find note under cursor
                const clickedNote = state.notes.find(n => {
                    if (n.lane !== pos.lane) return false;
                    if (n.type === 'short') {
                        return Math.abs(n.beat - pos.beat) < 0.1;
                    } else {
                        return pos.beat >= n.beat - 0.1 && pos.beat <= (n.beat + (n.duration || 0) + 0.1);
                    }
                });
                if (clickedNote) {
                    onRemoveNote(clickedNote.id);
                }
            }
            return;
        }

        // Starting to drag for a note
        if (e.button === 0) {
            const pos = getGridPosition(e);
            if (pos) {
                setDragStart(pos);
                setDragCurrent(pos);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragStart) {
            const pos = getGridPosition(e);
            if (pos) {
                setDragCurrent(pos);
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragStart && dragCurrent && e.button === 0) {
            const startBeat = dragStart.beat;
            const endBeat = dragCurrent.beat;
            const lane = dragStart.lane;

            const secondsPerBeat = 60 / state.bpm;

            if (Math.abs(startBeat - endBeat) > 0.01) {
                // Long note
                const minBeat = Math.min(startBeat, endBeat);
                const maxBeat = Math.max(startBeat, endBeat);
                onAddNote({
                    id: Math.random().toString(36).substring(7),
                    lane,
                    beat: minBeat,
                    time: minBeat * secondsPerBeat,
                    type: 'long',
                    duration: maxBeat - minBeat
                });
            } else {
                // Short note
                onAddNote({
                    id: Math.random().toString(36).substring(7),
                    lane,
                    beat: startBeat,
                    time: startBeat * secondsPerBeat,
                    type: 'short'
                });
            }
        }
        setDragStart(null);
        setDragCurrent(null);
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent default browser context menu
    };

    return (
        <div ref={containerRef} className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden bg-surface relative select-none">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
                className="absolute top-0 left-0 cursor-crosshair"
                style={{ height: totalHeight }}
            />
        </div>
    );
}
