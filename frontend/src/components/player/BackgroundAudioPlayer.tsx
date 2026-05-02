import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Loader2 } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

/**
 * BackgroundAudioPlayer — Mobile-only toggle + audio engine.
 * 
 * When activated:
 * - Fetches a direct audio stream URL from the backend
 * - Sets isBackgroundMode=true in the store (VideoSection reacts by hiding iframe)
 * - Plays audio via a standard <audio> element (supports background/lock-screen playback)
 * - Drives currentTime in the store so subtitles stay in sync
 * - Sets up Media Session API for lock-screen controls
 * 
 * When deactivated:
 * - Sets isBackgroundMode=false (VideoSection recreates the iframe)
 * - Pauses and cleans up the audio element
 */
export const BackgroundAudioPlayer: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const pollRef = useRef<number | null>(null);
    
    const {
        videoId, isPlaying, setPlaying, setCurrentTime,
        lessonTitle,
        skipNextSentence, skipPrevSentence,
        isBackgroundMode, backgroundAudioUrl, setBackgroundMode
    } = usePlayerStore();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ─── Activate: Fetch audio URL and switch mode ───────────────
    const activateBackgroundMode = async () => {
        if (!videoId || isLoading) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const res = await axios.get(`/api/content/audio-stream/${videoId}`, { timeout: 30000 });
            if (res.data.success && res.data.audio_url) {
                // Save the current position before switching
                const savedTime = usePlayerStore.getState().currentTime;
                
                // Stop YouTube first, then activate background mode
                setPlaying(false);
                
                // Small delay to let YouTube pause, then switch mode
                setTimeout(() => {
                    setBackgroundMode(true, res.data.audio_url);
                    
                    // Wait for audio element to mount, then seek and play
                    setTimeout(() => {
                        if (audioRef.current) {
                            audioRef.current.currentTime = savedTime;
                            audioRef.current.play().then(() => {
                                setPlaying(true);
                                setupMediaSession();
                            }).catch(() => {});
                        }
                    }, 300);
                }, 200);
            } else {
                setError('Không thể trích xuất audio');
            }
        } catch (e) {
            setError('Lỗi kết nối server');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Deactivate: Switch back to YouTube iframe ───────────────
    const deactivateBackgroundMode = () => {
        const savedTime = audioRef.current?.currentTime || usePlayerStore.getState().currentTime;
        
        // Stop audio
        if (audioRef.current) {
            audioRef.current.pause();
        }
        stopPolling();
        setPlaying(false);
        
        // Switch mode back — VideoSection will recreate the iframe
        setBackgroundMode(false, null);
        
        // After iframe recreates, seek to the saved position
        setTimeout(() => {
            usePlayerStore.getState().requestSeek(savedTime);
        }, 1000);
    };

    // ─── Polling: Sync audio currentTime → store ─────────────────
    const startPolling = () => {
        stopPolling();
        pollRef.current = window.setInterval(() => {
            if (audioRef.current && !audioRef.current.paused) {
                setCurrentTime(audioRef.current.currentTime);
            }
        }, 200);
    };

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    // ─── Sync play/pause from store → audio element ──────────────
    useEffect(() => {
        if (!isBackgroundMode || !audioRef.current) return;
        
        if (isPlaying) {
            audioRef.current.play().catch(() => {});
            startPolling();
        } else {
            audioRef.current.pause();
            stopPolling();
        }
    }, [isPlaying, isBackgroundMode]);

    // ─── Handle seek requests from store ─────────────────────────
    useEffect(() => {
        if (!isBackgroundMode || !audioRef.current) return;
        const seekTo = usePlayerStore.getState().seekToTime;
        if (seekTo !== null) {
            audioRef.current.currentTime = seekTo;
            usePlayerStore.setState({ seekToTime: null, isSeeking: false });
        }
    }, [usePlayerStore.getState().seekToTime]);

    // ─── Media Session (lock screen controls) ────────────────────
    const setupMediaSession = () => {
        if (!('mediaSession' in navigator) || !videoId) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: lessonTitle || 'PodLearn Lesson',
            artist: 'PodLearn 🎧 Background Mode',
            album: 'Language Learning',
            artwork: [
                { src: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' }
            ]
        });

        navigator.mediaSession.setActionHandler('play', () => setPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => skipPrevSentence());
        navigator.mediaSession.setActionHandler('nexttrack', () => skipNextSentence());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            if (audioRef.current) audioRef.current.currentTime -= 5;
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            if (audioRef.current) audioRef.current.currentTime += 5;
        });
    };

    // ─── Cleanup on unmount ──────────────────────────────────────
    useEffect(() => {
        return () => {
            stopPolling();
            if (isBackgroundMode) {
                setBackgroundMode(false, null);
            }
        };
    }, []);

    // ─── Render: Toggle button (mobile only) ─────────────────────
    return (
        <>
            {/* Hidden audio element — always mounted so ref is stable */}
            {isBackgroundMode && backgroundAudioUrl && (
                <audio
                    ref={audioRef}
                    src={backgroundAudioUrl}
                    playsInline
                    preload="auto"
                    onEnded={() => setPlaying(false)}
                    onPlay={() => {
                        startPolling();
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = 'playing';
                        }
                    }}
                    onPause={() => {
                        stopPolling();
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = 'paused';
                        }
                    }}
                    className="hidden"
                />
            )}

            {/* Toggle button */}
            <button
                onClick={isBackgroundMode ? deactivateBackgroundMode : activateBackgroundMode}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 ${
                    isBackgroundMode
                        ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                }`}
                title={isBackgroundMode ? "Tắt Background Mode" : "Background Mode - Nghe khi tắt màn hình"}
            >
                {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : (
                    <Headphones size={14} />
                )}
                {error && <span className="text-[9px] text-red-400">{error}</span>}
            </button>
        </>
    );
};
