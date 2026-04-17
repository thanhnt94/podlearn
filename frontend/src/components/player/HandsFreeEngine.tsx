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
        handsFreeModeEnabled, handsFreeType, handsFreeStatus, lessonId, videoId, ttsTrackSource,
        setHandsFreeStatus, setHandsFreeTaskId, setHandsFreeProgress, 
        setHandsFreeAudioData, setHandsFreeOriginalData,
        handsFreeTaskId, handsFreeAudioUrl, handsFreeOriginalUrl,
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
        
        audio.ontimeupdate = () => {
            setCurrentTime(audio.currentTime);
        };

        return () => {
            audio.pause();
            audio.src = '';
            audioRef.current = null;
        };
    }, [setPlaying, setCurrentTime]);

    // 2. Fetch Original Audio (Automatically when active)
    useEffect(() => {
        if (!handsFreeModeEnabled || !videoId || handsFreeOriginalUrl || handsFreeStatus === 'generating') return;

        const fetchOriginal = async () => {
            try {
                const res = await fetch(`/api/handsfree/original/${videoId}`);
                const data = await res.json();
                if (data.audio_url) {
                    setHandsFreeOriginalData(data.audio_url, data.total_duration);
                }
            } catch (err) {
                console.error("Failed to fetch original audio:", err);
            }
        };

        fetchOriginal();
    }, [handsFreeModeEnabled, videoId, handsFreeOriginalUrl, handsFreeStatus]);

    // 3. Start Generation / Polling Logic (Mixed Mode)
    useEffect(() => {
        if (handsFreeType !== 'mixed' || !handsFreeModeEnabled || !lessonId || !videoId || handsFreeAudioUrl || handsFreeTaskId) return;

        const checkCacheAndStart = async () => {
            setHandsFreeStatus('generating');
            
            try {
                const cacheRes = await fetch(`/api/handsfree/cached/${videoId}?lang=vi`);
                const cacheData = await cacheRes.json();
                
                if (cacheData.cached) {
                    setHandsFreeAudioData(cacheData.audio_url, cacheData.timeline, cacheData.total_duration);
                    setHandsFreeStatus('idle');
                    return;
                }

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
    }, [handsFreeType, handsFreeModeEnabled, lessonId, videoId, ttsTrackSource, handsFreeAudioUrl, handsFreeTaskId]);

    // 4. Polling for Status
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

    // 5. Source Switching Logic
    useEffect(() => {
        if (!audioRef.current || !handsFreeModeEnabled) return;

        const targetUrl = handsFreeType === 'mixed' ? handsFreeAudioUrl : handsFreeOriginalUrl;
        if (!targetUrl) return;

        const fullTargetUrl = targetUrl.startsWith('http') ? targetUrl : window.location.origin + targetUrl;
        if (audioRef.current.src !== fullTargetUrl) {
            const wasPlaying = !audioRef.current.paused;
            audioRef.current.src = fullTargetUrl;
            audioRef.current.load();
            if (wasPlaying) audioRef.current.play();
        }
    }, [handsFreeType, handsFreeAudioUrl, handsFreeOriginalUrl, handsFreeModeEnabled]);

    // 6. Playback State Sync
    const isPlaying = usePlayerStore(state => state.isPlaying);
    useEffect(() => {
        if (!audioRef.current || !handsFreeModeEnabled) return;
        
        const targetUrl = handsFreeType === 'mixed' ? handsFreeAudioUrl : handsFreeOriginalUrl;
        if (!targetUrl) return;

        if (isPlaying && audioRef.current.paused) {
            audioRef.current.play().catch(e => console.warn("Audio play prevented:", e));
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }
    }, [isPlaying, handsFreeModeEnabled, handsFreeType, handsFreeAudioUrl, handsFreeOriginalUrl]);

    // 7. Stop Video Player
    useEffect(() => {
        if (handsFreeModeEnabled) {
            const player = (window as any).ytPlayer;
            if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            }
        }
    }, [handsFreeModeEnabled]);

    return null;
};
