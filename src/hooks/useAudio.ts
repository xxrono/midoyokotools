import { useState, useEffect, useRef, useCallback } from 'react';

export type HitSoundType = 'tick' | 'click' | 'snare' | 'kick' | 'custom';

export function useAudio() {
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [hitSoundType, setHitSoundType] = useState<HitSoundType>('snare');
    const [customHitSoundBuffer, setCustomHitSoundBuffer] = useState<AudioBuffer | null>(null);

    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationRef = useRef<number>(0);

    // Initialize Audio Context on first user interaction 
    // (Browsers require user gesture to start AudioContext)
    const initAudio = useCallback(() => {
        if (!audioContext) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(ctx);
            return ctx;
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return audioContext;
    }, [audioContext]);

    const loadAudioFile = async (file: File) => {
        const ctx = initAudio();
        const arrayBuffer = await file.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decodedBuffer);
        setDuration(decodedBuffer.duration);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        if (isPlaying) stop();
    };

    const loadCustomHitSound = async (file: File) => {
        const ctx = initAudio();
        try {
            const arrayBuffer = await file.arrayBuffer();
            const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
            setCustomHitSoundBuffer(decodedBuffer);
            setHitSoundType('custom');
        } catch (e) {
            console.error("Failed to load hit sound", e);
            alert("Failed to load hit sound audio.");
        }
    };

    const play = useCallback(() => {
        if (!audioBuffer || !audioContext) return;

        // Stop any existing source
        if (sourceRef.current) {
            sourceRef.current.disconnect();
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        startTimeRef.current = audioContext.currentTime - pauseTimeRef.current;
        source.start(0, pauseTimeRef.current);
        sourceRef.current = source;
        setIsPlaying(true);

        const updateTime = () => {
            setCurrentTime(audioContext.currentTime - startTimeRef.current);
            animationRef.current = requestAnimationFrame(updateTime);
        };
        animationRef.current = requestAnimationFrame(updateTime);

        source.onended = () => {
            // Check if naturally ended or stopped manually
            if (sourceRef.current === source) {
                setIsPlaying(false);
                pauseTimeRef.current = 0;
                setCurrentTime(audioBuffer.duration);
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [audioBuffer, audioContext]);

    const pause = useCallback(() => {
        if (!audioContext || !sourceRef.current) return;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
        pauseTimeRef.current = audioContext.currentTime - startTimeRef.current;
        setIsPlaying(false);
        cancelAnimationFrame(animationRef.current);
    }, [audioContext]);

    const stop = useCallback(() => {
        if (sourceRef.current) {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        setIsPlaying(false);
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        cancelAnimationFrame(animationRef.current);
    }, []);

    const seek = useCallback((time: number) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) {
            pause();
        }
        pauseTimeRef.current = Math.max(0, Math.min(time, duration));
        setCurrentTime(pauseTimeRef.current);
        if (wasPlaying) {
            play();
        }
    }, [isPlaying, duration, pause, play]);

    // Clean up
    useEffect(() => {
        return () => {
            if (sourceRef.current) {
                sourceRef.current.stop();
                sourceRef.current.disconnect();
            }
            cancelAnimationFrame(animationRef.current);
            if (audioContext) {
                audioContext.close();
            }
        };
    }, [audioContext]);

    // Method to play a synthesized sound or custom buffer for feedback
    const playHitSound = useCallback(() => {
        if (!audioContext || audioContext.state !== 'running') return;

        if (hitSoundType === 'custom' && customHitSoundBuffer) {
            const source = audioContext.createBufferSource();
            source.buffer = customHitSoundBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            return;
        }

        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const time = audioContext.currentTime;

        switch (hitSoundType) {
            case 'tick':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.05);
                gainNode.gain.setValueAtTime(0.8, time);
                gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
                osc.start(time);
                osc.stop(time + 0.05);
                break;
            case 'click':
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.02);
                gainNode.gain.setValueAtTime(0.5, time);
                gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.02);
                osc.start(time);
                osc.stop(time + 0.02);
                break;
            case 'snare': {
                const bufferSize = audioContext.sampleRate * 0.1;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;
                const noiseFilter = audioContext.createBiquadFilter();
                noiseFilter.type = 'highpass';
                noiseFilter.frequency.value = 1000;
                noise.connect(noiseFilter);
                noiseFilter.connect(gainNode);

                gainNode.gain.setValueAtTime(0.6, time);
                gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                noise.start(time);
                break;
            }
            case 'kick':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
                gainNode.gain.setValueAtTime(0.8, time);
                gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                osc.start(time);
                osc.stop(time + 0.1);
                break;
            default:
                break;
        }
    }, [audioContext, hitSoundType, customHitSoundBuffer]);

    return {
        ready: !!audioBuffer,
        initAudio,
        loadAudioFile,
        play,
        pause,
        stop,
        seek,
        playHitSound,
        hitSoundType,
        setHitSoundType,
        loadCustomHitSound,
        customHitSoundBuffer,
        isPlaying,
        currentTime,
        duration,
        audioBuffer,
    };
}
