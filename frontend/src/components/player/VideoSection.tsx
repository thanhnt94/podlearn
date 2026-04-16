import React, { useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SubtitleOverlay } from './SubtitleOverlay';
import { VideoControls } from './VideoControls';
import { NoteOverlay } from './NoteOverlay';
import { DanmakuLayer } from './DanmakuLayer';

// Add global type for YT
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
    __PODLEARN_DATA__: any;
  }
}

export const VideoSection: React.FC = () => {
  const playerRef = useRef<HTMLDivElement>(null);
  const ytPlayer = useRef<any>(null);
  const pollInterval = useRef<number | null>(null);
  
  const { 
    videoId, setPlaying, setCurrentTime, setDuration, isPlaying, seekToTime,
    volume, playbackRate, isLockedPaused, isNativeCCOn, nativeCCLang, originalLang
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
    } else if (!isPlaying && currentState === window.YT.PlayerState.PLAYING) {
      ytPlayer.current.pauseVideo();
    }
  }, [isPlaying, isLockedPaused]);

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
    <div id="player-container" className="relative w-full aspect-video bg-black group overflow-hidden">
      {/* YouTube Iframe Placeholder */}
      <div 
        ref={playerRef}
        id="yt-player-element" 
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Click-to-toggle overlay (Play/Pause) */}
      <div 
        className="absolute inset-0 cursor-pointer z-10" 
        onClick={() => setPlaying(!isPlaying)}
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
