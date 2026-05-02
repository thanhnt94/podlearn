import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Loader2, X, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

/**
 * BackgroundAudioPlayer — Mobile-only audio player that extracts YouTube audio
 * and plays it via a standard <audio> element for background playback support.
 * 
 * When active, it takes over playback from the YouTube iframe:
 * - Pauses the iframe
 * - Syncs currentTime to the audio element
 * - Enables lock-screen controls via Media Session API
 */
export const BackgroundAudioPlayer: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const pollRef = useRef<number | null>(null);
    
    const {
        videoId, isPlaying, setPlaying, setCurrentTime,
        currentTime, duration, lessonTitle,
        skipNextSentence, skipPrevSentence
    } = usePlayerStore();

    const [isActive, setIsActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch audio stream URL when activated
    const activateBackgroundMode = async () => {
        if (!videoId || isLoading) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const res = await axios.get(`/api/content/audio-stream/${videoId}`);
            if (res.data.success && res.data.audio_url) {
                setAudioUrl(res.data.audio_url);
                setIsActive(true);
                
                // Pause the YouTube iframe
                setPlaying(false);
                
                // Wait for audio element to load, then seek to current position and play
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.currentTime = currentTime;
                        audioRef.current.play().then(() => {
                            setPlaying(true);
                            setupMediaSession();
                        }).catch(() => {});
                    }
                }, 500);
            } else {
                setError('Không thể trích xuất audio');
            }
        } catch (e) {
            setError('Lỗi kết nối server');
        } finally {
            setIsLoading(false);
        }
    };

    const deactivateBackgroundMode = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            // Sync position back to YouTube
            const pos = audioRef.current.currentTime;
            usePlayerStore.getState().requestSeek(pos);
        }
        setIsActive(false);
        setAudioUrl(null);
        stopPolling();
    };

    // Poll currentTime from audio element
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

    // Sync play/pause from store to audio element
    useEffect(() => {
        if (!isActive || !audioRef.current) return;
        
        if (isPlaying) {
            audioRef.current.play().catch(() => {});
            startPolling();
        } else {
            audioRef.current.pause();
            stopPolling();
        }
    }, [isPlaying, isActive]);

    // Setup Media Session (lock screen controls)
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, []);

    // Handle seek from store (e.g. clicking on transcript)
    useEffect(() => {
        const seekTo = usePlayerStore.getState().seekToTime;
        if (isActive && audioRef.current && seekTo !== null) {
            audioRef.current.currentTime = seekTo;
        }
    }, [usePlayerStore.getState().seekToTime]);

    // Toggle button (only shown on mobile)
    if (!isActive) {
        return (
            <button
                onClick={activateBackgroundMode}
                disabled={isLoading}
                className="md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
                title="Background Mode - Nghe khi tắt màn hình"
            >
                {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : (
                    <Headphones size={14} />
                )}
                {error && <span className="text-[9px] text-red-400">{error}</span>}
            </button>
        );
    }

    // Active background player UI
    return (
        <>
            {/* Hidden audio element — the real player */}
            <audio
                ref={audioRef}
                src={audioUrl || undefined}
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
            />

            {/* Floating mini player (mobile only) */}
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="md:hidden fixed bottom-20 left-3 right-3 z-[200] bg-gradient-to-r from-amber-950/95 to-slate-950/95 backdrop-blur-2xl border border-amber-500/20 rounded-2xl shadow-[0_8px_32px_rgba(245,158,11,0.15)] p-3"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.15em]">
                                🎧 Background Mode
                            </span>
                        </div>
                        <button 
                            onClick={deactivateBackgroundMode}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Title */}
                    <p className="text-[11px] text-white/80 font-semibold truncate mb-2">
                        {lessonTitle || 'Đang phát...'}
                    </p>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-6">
                        <button 
                            onClick={skipPrevSentence}
                            className="text-white/60 hover:text-white active:scale-90 transition-all"
                        >
                            <SkipBack size={20} />
                        </button>
                        
                        <button 
                            onClick={() => setPlaying(!isPlaying)}
                            className="bg-amber-500 text-slate-950 p-2.5 rounded-full hover:bg-amber-400 active:scale-90 transition-all shadow-lg shadow-amber-500/30"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>
                        
                        <button 
                            onClick={skipNextSentence}
                            className="text-white/60 hover:text-white active:scale-90 transition-all"
                        >
                            <SkipForward size={20} />
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] text-white/40 font-mono tabular-nums">
                            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                        </span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-amber-500 rounded-full transition-all"
                                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                            />
                        </div>
                        <span className="text-[9px] text-white/40 font-mono tabular-nums">
                            {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                        </span>
                    </div>

                    {/* Tip */}
                    <p className="text-[8px] text-amber-500/50 text-center mt-1.5 tracking-wide">
                        Có thể tắt màn hình • Điều khiển từ lock screen
                    </p>
                </motion.div>
            </AnimatePresence>
        </>
    );
};
