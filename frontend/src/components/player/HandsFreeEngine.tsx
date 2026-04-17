import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';

/**
 * HandsFreeEngine V2 — Audio Podcast Mode.
 * 
 * Instead of controlling the YouTube player, this engine:
 * 1. Generates/Fetches a podcast audio file from the backend.
 * 2. Plays it using a native HTML5 Audio element.
 * 3. Synchronizes the timeline (original + TTS) with the UI subtitles.
 * 
 * This allows background playback on mobile (screen off).
 */
export const HandsFreeEngine: React.FC = () => {
    const { 
        handsFreeModeEnabled, lessonId, videoId, ttsTrackSource,
        setHandsFreeStatus, setHandsFreeTaskId, setHandsFreeProgress, setHandsFreeAudioData,
        handsFreeTaskId, handsFreeAudioUrl, handsFreeTimeline,
        setPlaying, setCurrentTime,
    } = usePlayerStore();

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pollInterval = useRef<number | null>(null);

    // 1. Core Audio Element Lifecycle
    useEffect(() => {
        const audio = new Audio();
        audioRef.current = audio;
        
        audio.onplay = () => setPlaying(true);
        audio.onpause = () => setPlaying(false);
        audio.onended = () => setPlaying(false);
        
        // Sync audio time to global store for transcript scrolling
        audio.ontimeupdate = () => {
            if (!handsFreeTimeline) return;
            const time = audio.currentTime;
            
            // Note: We MUST update currentTime so the UI knows where we are.
            // activeLineIndex is derived from currentTime in the store logic generally.
            setCurrentTime(time);
        };

        return () => {
            audio.pause();
            audio.src = '';
            audioRef.current = null;
        };
    }, [handsFreeTimeline, setPlaying, setCurrentTime]);

    // 2. Start Generation / Polling Logic
    useEffect(() => {
        if (!handsFreeModeEnabled || !lessonId || !videoId || handsFreeAudioUrl || handsFreeTaskId) return;

        const checkCacheAndStart = async () => {
            setHandsFreeStatus('generating');
            
            try {
                // First, check if it's already cached on the server
                const cacheRes = await fetch(`/api/handsfree/cached/${videoId}?lang=vi`);
                const cacheData = await cacheRes.json();
                
                if (cacheData.cached) {
                    setHandsFreeAudioData(cacheData.audio_url, cacheData.timeline, cacheData.total_duration);
                    setHandsFreeStatus('idle');
                    return;
                }

                // If not cached, start generation
                const response = await fetch('/api/handsfree/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        video_id: videoId,
                        lesson_id: lessonId,
                        track_source: ttsTrackSource,
                        lang: 'vi' 
                    })
                });
                
                const data = await response.json();
                if (data.status === 'completed') {
                    setHandsFreeAudioData(data.audio_url, data.timeline, data.total_duration);
                    setHandsFreeStatus('idle');
                } else if (data.task_id) {
                    setHandsFreeTaskId(data.task_id);
                }
            } catch (err) {
                console.error("HandsFree initiation failed:", err);
                setHandsFreeStatus('idle');
            }
        };

        checkCacheAndStart();
    }, [handsFreeModeEnabled, lessonId, videoId, ttsTrackSource, handsFreeAudioUrl, handsFreeTaskId]);

    // 3. Polling for Status
    useEffect(() => {
        if (!handsFreeTaskId) return;

        pollInterval.current = window.setInterval(async () => {
            try {
                const res = await fetch(`/api/handsfree/status/${handsFreeTaskId}`);
                const data = await res.json();

                setHandsFreeProgress(data.progress || 0, data.step || '');

                if (data.status === 'completed') {
                    setHandsFreeAudioData(data.audio_url, data.timeline, data.total_duration);
                    setHandsFreeTaskId(null);
                    setHandsFreeStatus('idle');
                    if (pollInterval.current) clearInterval(pollInterval.current);
                } else if (data.status === 'failed') {
                    console.error("HandsFree generation failed:", data.error);
                    setHandsFreeTaskId(null);
                    setHandsFreeStatus('idle');
                    if (pollInterval.current) clearInterval(pollInterval.current);
                }
            } catch (err) {
                console.error("HandsFree poll error:", err);
            }
        }, 3000);

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [handsFreeTaskId]);

    // 4. Handle Playback Commands from Store
    useEffect(() => {
        if (!audioRef.current || !handsFreeAudioUrl) return;

        // Sync Audio Source
        if (audioRef.current.src !== window.location.origin + handsFreeAudioUrl) {
            audioRef.current.src = handsFreeAudioUrl;
            audioRef.current.load();
        }

        // Note: Play/Pause is usually handled by the store's isPlaying state
        // but since we hijack playback in HandsFree mode, we need to observe it.
    }, [handsFreeAudioUrl]);

    // Sync isPlaying state to native audio
    const isPlaying = usePlayerStore(state => state.isPlaying);
    useEffect(() => {
        if (!audioRef.current || !handsFreeAudioUrl) return;
        
        if (isPlaying && audioRef.current.paused) {
            audioRef.current.play().catch(e => console.warn("Audio play prevented:", e));
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }
    }, [isPlaying, handsFreeAudioUrl]);

    // Cleanup video player when handsfree is active
    useEffect(() => {
        if (handsFreeModeEnabled) {
            // Pause the YouTube player if it exists
            const player = (window as any).ytPlayer;
            if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            }
        }
    }, [handsFreeModeEnabled]);

    return null; // Logic only
};
