import React, { useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SubtitleOverlay } from './SubtitleOverlay';
import { VideoControls } from './VideoControls';
import { NoteOverlay } from './NoteOverlay';
import { DanmakuLayer } from './DanmakuLayer';
import { useSwipe } from '../../hooks/useSwipe';
import { soundEffects } from '../../services/SoundEffectsService';

// Add global type for YT
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export const VideoSection: React.FC = () => {
  const playerRef = useRef<HTMLDivElement>(null);
  const ytPlayer = useRef<any>(null);
  const pollInterval = useRef<number | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wasPlayingRef = useRef(false);
  
  const { 
    videoId, setPlaying, setCurrentTime, setDuration, isPlaying, seekToTime,
    volume, setVolume, playbackRate, isLockedPaused, isNativeCCOn, nativeCCLang, originalLang,
    requestSeek, initialListeningSeconds, sessionListeningSeconds, sessionShadowingCount,
    lessonTitle
  } = usePlayerStore();

  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    if (ytPlayer.current && isReady && ytPlayer.current.setPlaybackRate) {
      ytPlayer.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, isReady]);

  useEffect(() => {
    // Load YT API if not present
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
    const initPlayer = () => {
      setIsReady(false); // Reset on new video
      if (!videoId || !playerRef.current) return;
      
      // Safety: If there is an existing player, destroy it first
      if (ytPlayer.current) {
        try {
            ytPlayer.current.destroy();
            ytPlayer.current = null;
        } catch (e) {}
      }

      ytPlayer.current = new window.YT.Player(playerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          controls: 0, // We will build custom controls
          cc_load_policy: 0, // Prevent forced captions
          iv_load_policy: 3, // Disable annotations
        },
        events: {
          onReady: (event: any) => {
            if (ytPlayer.current) {
                setDuration(event.target.getDuration());
                setIsReady(true); // MARK AS READY
            }
          },
          // ... onStateChange and onError ...
          onStateChange: (event: any) => {
            if (!ytPlayer.current) return;
            const state = event.data;
            
            // CRITICAL FIX: If we are in a locked state (Curation), force pause
            if (state === window.YT.PlayerState.PLAYING) {
              if (usePlayerStore.getState().isLockedPaused) {
                event.target.pauseVideo();
                return;
              }
              setPlaying(true);
              startPolling();
            } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) {
              setPlaying(false);
              stopPolling();
            }
          },
          onError: (e: any) => {
              console.error("YouTube Player Error", e.data);
          }
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      stopPolling();
      if (ytPlayer.current) {
        try {
            const temp = ytPlayer.current;
            ytPlayer.current = null;
            temp.destroy();
        } catch (e) {}
      }
    };
  }, [videoId]);

  const startPolling = () => {
    stopPolling();
    pollInterval.current = window.setInterval(() => {
      if (ytPlayer.current && ytPlayer.current.getCurrentTime) {
        setCurrentTime(ytPlayer.current.getCurrentTime());
      }
    }, 100);
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const formatSessionTime = (seconds: number) => {
    const totalSecs = Number(initialListeningSeconds || 0) + Number(seconds || 0);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  // Initialize Background Audio Keeper (Web Audio API)
  useEffect(() => {
    if (!audioCtxRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        // Create a near-silent oscillator (inaudible frequency, near-zero volume)
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.frequency.value = 1; // 1Hz - inaudible
        gainNode.gain.value = 0.001; // Near-silent
        oscillator.connect(gainNode);
        
        // Route through MediaStream -> real <audio> element
        const dest = ctx.createMediaStreamDestination();
        gainNode.connect(dest);
        gainNode.connect(ctx.destination); // Also connect to output for Media Session
        oscillator.start();
        
        if (bgAudioRef.current) {
          bgAudioRef.current.srcObject = dest.stream;
        }
        audioCtxRef.current = ctx;
      } catch (e) {
        console.warn('Background audio init failed:', e);
      }
    }
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Sync isPlaying state from Store to Player (manual control)
  useEffect(() => {
    if (!ytPlayer.current || !isReady || !ytPlayer.current.getPlayerState) return;
    const currentState = ytPlayer.current.getPlayerState();
    
    // Safety check for Locked State
    if (isLockedPaused) {
      if (currentState === window.YT.PlayerState.PLAYING) {
        ytPlayer.current.pauseVideo();
      }
      return;
    }

    if (isPlaying && currentState !== window.YT.PlayerState.PLAYING) {
      ytPlayer.current.playVideo();
      // Resume AudioContext and start background audio
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (bgAudioRef.current) bgAudioRef.current.play().catch(() => {});
    } else if (!isPlaying && currentState === window.YT.PlayerState.PLAYING) {
      ytPlayer.current.pauseVideo();
      if (bgAudioRef.current) bgAudioRef.current.pause();
    }
  }, [isPlaying, isLockedPaused]);

  // Page Visibility: Auto-resume YouTube when returning to app
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Remember if we were playing before leaving
        wasPlayingRef.current = usePlayerStore.getState().isPlaying;
      } else if (document.visibilityState === 'visible') {
        // Returned to app - try to resume if was playing
        if (wasPlayingRef.current && ytPlayer.current && isReady) {
          setTimeout(() => {
            try {
              const state = ytPlayer.current?.getPlayerState?.();
              if (state !== window.YT.PlayerState.PLAYING) {
                ytPlayer.current.playVideo();
                usePlayerStore.setState({ isPlaying: true });
              }
            } catch (e) {}
          }, 300);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isReady]);

  // Media Session API for Lock Screen Controls
  useEffect(() => {
    if ('mediaSession' in navigator && videoId) {
      const { lessonTitle: title, skipNextSentence, skipPrevSentence, setPlaying: sp, requestSeek: rs } = usePlayerStore.getState();
      
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: title || 'PodLearn Lesson',
        artist: 'PodLearn AuraFlow',
        album: 'Language Learning',
        artwork: [
          { src: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => sp(true));
      navigator.mediaSession.setActionHandler('pause', () => sp(false));
      navigator.mediaSession.setActionHandler('previoustrack', () => skipPrevSentence());
      navigator.mediaSession.setActionHandler('nexttrack', () => skipNextSentence());
      navigator.mediaSession.setActionHandler('seekbackward', () => rs(usePlayerStore.getState().currentTime - 5));
      navigator.mediaSession.setActionHandler('seekforward', () => rs(usePlayerStore.getState().currentTime + 5));
    }
  }, [videoId, lessonTitle]);

  // Handle Seek Requests from Store
  useEffect(() => {
    if (seekToTime !== null && ytPlayer.current && isReady && ytPlayer.current.seekTo) {
      ytPlayer.current.seekTo(seekToTime, true);
      // Reset seek request in store AND unlock poller
      usePlayerStore.setState({ seekToTime: null, isSeeking: false });
    }
  }, [seekToTime, isReady]);

  // Handle Native CC Toggle
  useEffect(() => {
    if (!ytPlayer.current || !isReady || !ytPlayer.current.loadModule) return;
    try {
      if (isNativeCCOn) {
        ytPlayer.current.loadModule("captions");
        if (nativeCCLang === originalLang) {
            ytPlayer.current.setOption("captions", "track", { languageCode: nativeCCLang });
        } else {
            // Attempt to force Auto-Translate via undocumented translationLanguage Option
            ytPlayer.current.setOption("captions", "track", { 
                languageCode: originalLang, 
                translationLanguage: { languageCode: nativeCCLang }
            });
        }
      } else {
        ytPlayer.current.unloadModule("captions");
      }
    } catch (e) {
      console.warn("Failed to toggle YouTube Native CC", e);
    }
  }, [isNativeCCOn, isReady, nativeCCLang]);

  // 5. Volume Sync
  useEffect(() => {
    if (ytPlayer.current && isReady && ytPlayer.current.setVolume) {
      ytPlayer.current.setVolume(volume);
    }
  }, [volume, isReady]);

  return (
    <div id="player-container" className="relative w-full h-full bg-black group overflow-hidden">
      {/* Background Audio Keeper - real MediaStream for lock screen support */}
      <audio 
        ref={bgAudioRef}
        id="bg-audio-helper"
        loop
        playsInline
        className="hidden"
      />

      {/* YouTube Iframe Placeholder */}
      <div 
        ref={playerRef}
        id="yt-player-element" 
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Gesture / Interaction Layer */}
      <div 
        className="absolute inset-0 cursor-pointer z-10" 
        onClick={(e) => {
            const now = Date.now();
            const lastTap = (window as any).__lastTap || 0;
            const delta = now - lastTap;
            (window as any).__lastTap = now;

            if (delta < 300) {
                // Double tap
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                if (x < rect.width / 3) {
                    // Left 1/3: Seek back
                    soundEffects.vibrate(20);
                    requestSeek(usePlayerStore.getState().currentTime - 5);
                } else if (x > (rect.width * 2) / 3) {
                    // Right 1/3: Seek forward
                    soundEffects.vibrate(20);
                    requestSeek(usePlayerStore.getState().currentTime + 5);
                } else {
                    // Center: Fullscreen toggle or something else
                    setPlaying(!isPlaying);
                }
            } else {
                // Single tap
                setTimeout(() => {
                    if (Date.now() - (window as any).__lastTap >= 300) {
                        setPlaying(!isPlaying);
                    }
                }, 300);
            }
        }}
        {...useSwipe({
            onSwipeLeft: () => {
                soundEffects.vibrate(30);
                requestSeek(usePlayerStore.getState().currentTime - 10);
            },
            onSwipeRight: () => {
                soundEffects.vibrate(30);
                requestSeek(usePlayerStore.getState().currentTime + 10);
            },
            onSwipeUp: () => {
                soundEffects.vibrate(10);
                setVolume(Math.min(100, volume + 10));
            },
            onSwipeDown: () => {
                soundEffects.vibrate(10);
                setVolume(Math.max(0, volume - 10));
            },
            threshold: 60
        })}
      />

      {/* Central Feedback Icon (Flash) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <AnimatePresence mode="wait">
          {!isPlaying ? (
            <motion.div 
               key="pause"
               initial={{ opacity: 0, scale: 0.5 }}
               animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.5] }}
               transition={{ duration: 0.6 }}
               className="bg-black/40 p-10 rounded-full text-white backdrop-blur-sm border border-white/10"
            >
              <Pause size={64} fill="currentColor" />
            </motion.div>
          ) : (
            <motion.div 
               key="play"
               initial={{ opacity: 0, scale: 0.5 }}
               animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.5] }}
               transition={{ duration: 0.6 }}
               className="bg-black/40 p-10 rounded-full text-white backdrop-blur-sm border border-white/10"
            >
              <Play size={64} fill="currentColor" className="ml-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Floating Session Timer (Top Right) */}
      {(Number(initialListeningSeconds) > 0 || Number(sessionListeningSeconds) > 0 || Number(sessionShadowingCount) > 0) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className="absolute top-6 right-6 z-[60] flex items-center gap-1.5 px-3 py-1 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-full shadow-2xl group/timer hover:bg-slate-900/60 transition-all duration-300"
          >
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-[10px] font-black text-emerald-400 font-mono tracking-widest tabular-nums">
                {formatSessionTime(sessionListeningSeconds)}
              </span>
          </motion.div>
      )}

      <SubtitleOverlay />
      <NoteOverlay />
      <DanmakuLayer />
      <VideoControls />

      {/* Loading State Overlay */}
      {!videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4">
          <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Connecting to AuraCloud...</span>
        </div>
      )}
    </div>
  );
};
