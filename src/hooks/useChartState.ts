import { useState, useCallback } from 'react';
import type { ChartState, Note } from '../types';

const INITIAL_STATE: ChartState = {
    bpm: 120,
    lanes: 4,
    division: 4,
    notes: [],
    offset: 0
};

export function useChartState() {
    const [state, setState] = useState<ChartState>(INITIAL_STATE);

    // Helper to commit state changes to history (undo/redo support later)
    const commit = useCallback((newState: ChartState) => {
        setState(newState);
        // Simple history management could be added here
    }, []);

    const updateBpm = (bpm: number) => commit({ ...state, bpm });
    const updateLanes = (lanes: number) => commit({ ...state, lanes });
    const updateDivision = (division: number) => commit({ ...state, division });
    const updateOffset = (offset: number) => commit({ ...state, offset });

    const addNote = (note: Note) => {
        commit({
            ...state,
            notes: [...state.notes, note].sort((a, b) => a.beat - b.beat)
        });
    };

    const updateNote = (id: string, updates: Partial<Note>) => {
        commit({
            ...state,
            notes: state.notes.map(n => n.id === id ? { ...n, ...updates } : n).sort((a, b) => a.beat - b.beat)
        });
    };

    const removeNote = (id: string) => {
        commit({
            ...state,
            notes: state.notes.filter(n => n.id !== id)
        });
    };

    const loadChart = (jsonString: string) => {
        try {
            const data = JSON.parse(jsonString);

            // Modern format check
            if (data.format === "Modern (Chart Editor)") {
                const bpm = data.bpm || 120;
                const secondsPerBeat = 60 / bpm;

                const mappedNotes: Note[] = (data.notes || []).map((n: any) => {
                    const time = n.time_ms / 1000;
                    const beat = time / secondsPerBeat;
                    const type = n.type === 2 ? 'long' : 'short';
                    const duration = type === 'long' && n.duration_ms ? (n.duration_ms / 1000) / secondsPerBeat : undefined;

                    return {
                        id: Math.random().toString(36).substring(7),
                        lane: n.lane,
                        time: time,
                        beat: beat,
                        type: type,
                        duration: duration
                    };
                });

                commit({
                    bpm: bpm,
                    lanes: data.maxLanes || 4,
                    division: data.division || 4,
                    offset: (data.offset_ms || 0) / 1000,
                    notes: mappedNotes.sort((a, b) => a.beat - b.beat)
                });
            } else {
                // Fallback for direct state import
                commit(data as ChartState);
            }
            return true;
        } catch (e) {
            console.error("Failed to parse chart data", e);
            return false;
        }
    };

    const exportChart = () => {
        const secondsPerBeat = 60 / state.bpm;

        const unityFormat = {
            name: "sample song",
            format: "Modern (Chart Editor)",
            bpm: state.bpm,
            division: state.division,
            offset_ms: Math.round(state.offset * 1000),
            maxLanes: state.lanes,
            notes: state.notes.map(n => {
                const isLong = n.type === 'long';
                const time_ms = Math.round(n.beat * secondsPerBeat * 1000);
                const duration_ms = isLong && n.duration ? Math.round(n.duration * secondsPerBeat * 1000) : undefined;

                const noteObj: any = {
                    time_ms,
                    lane: n.lane,
                    type: isLong ? 2 : 1,
                    notes: []
                };

                if (isLong && duration_ms !== undefined) {
                    noteObj.duration_ms = duration_ms;
                }

                return noteObj;
            })
        };

        return JSON.stringify(unityFormat, null, 2);
    };

    return {
        state,
        updateBpm,
        updateLanes,
        updateDivision,
        updateOffset,
        addNote,
        updateNote,
        removeNote,
        loadChart,
        exportChart
    };
}
