export type NoteType = 'short' | 'long';

export interface Note {
    id: string;      // Unique identifier
    lane: number;    // 0 to maxLanes - 1
    time: number;    // Absolute time in seconds, or Beat position (we'll use beat/ticks for exactness)
    beat: number;    // Fractional beat position (e.g., 4.5 is the 4th beat + half)
    type: NoteType;
    duration?: number; // For long notes: length in beats
}

export interface ChartState {
    bpm: number;
    lanes: number;
    division: number; // Beats per measure divided by this
    notes: Note[];
    offset: number; // Audio offset in seconds
}
