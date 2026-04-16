import React, { useState, useEffect } from 'react';
import { 
    BookOpen, Mic2, FileText, MessageSquare, 
    ArrowLeft, Settings, Check, Sparkles, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoSection } from './VideoSection';
import { TranscriptBody } from '../transcript/TranscriptBody';
import { ShadowingPanel } from '../tabs/ShadowingPanel';
import { NotesPanel } from '../tabs/NotesPanel';
import { VocabPanel } from '../tabs/VocabPanel';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SettingsDrawer } from '../layout/SettingsDrawer';
import { InsightsPanel } from '../tabs/InsightsPanel';
import { CommunityPanel } from '../tabs/CommunityPanel';

type TabType = 'transcript' | 'shadowing' | 'notes' | 'vocab' | 'insights' | 'community';

export const PlayerView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('transcript');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const { 
    isLoaded, videoId, lessonTitle,
    playbackRate, setPlaybackRate,
    activeLineIndex, subtitles,
    isCompleted, completeLesson,
    sidebarWidth, setSidebarWidth,
    isPlaying, addListeningTime, flushTrackingData,
    initialListeningSeconds, sessionListeningSeconds, sessionShadowingCount
  } = usePlayerStore();

  const formatSessionTime = (seconds: number) => {
    const totalSecs = Number(initialListeningSeconds || 0) + Number(seconds || 0);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  // Expose control to window for child components (e.g. TranscriptBody empty state)
  useEffect(() => {
    (window as any).openSettings = () => setIsSettingsOpen(true);
    return () => { delete (window as any).openSettings; };
  }, []);

  const progressLine = activeLineIndex !== -1 ? activeLineIndex + 1 : 0;
  const totalLines = subtitles.length;
  const progressPercent = totalLines > 0 ? Math.floor((progressLine / totalLines) * 100) : 0;

  // Heartbeat Tracking: Listen Time (Every 1s)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
        addListeningTime(1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, addListeningTime]);

  // Heartbeat Tracking: Flush to Server (Every 60s & Unmount)
  useEffect(() => {
    const bgInterval = setInterval(() => {
        flushTrackingData();
    }, 60000);

    const handleBeforeUnload = () => flushTrackingData();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        clearInterval(bgInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        flushTrackingData();
    };
  }, [flushTrackingData]);

  const renderPanel = () => {
    switch (activeTab) {
      case 'transcript': return <TranscriptBody />;
      case 'shadowing': return <ShadowingPanel />;
      case 'notes': return <NotesPanel />;
      case 'vocab': return <VocabPanel />;
      case 'insights': return <InsightsPanel />;
      case 'community': return <CommunityPanel />;
      default: return <TranscriptBody />;
    }
  };

  const tabs = [
    { id: 'transcript', label: 'Transcript', icon: FileText },
    { id: 'shadowing', label: 'Shadowing', icon: Mic2 },
    { id: 'notes', label: 'Notes', icon: MessageSquare },
    { id: 'vocab', label: 'Vocab', icon: BookOpen },
    { id: 'insights', label: 'AI', icon: Sparkles },
    { id: 'community', label: 'Social', icon: Users },
  ];

  // Resize Logic
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate from right edge
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  if (!isLoaded || !videoId) {
      return (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#020617] overflow-hidden">
              {/* Subtle background grain/noise for premium feel */}
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-50" />
              
              <div className="relative z-10 flex flex-col items-center gap-8">
                  <div className="relative">
                      <div className="w-24 h-24 border-4 border-sky-500/10 border-t-sky-500 rounded-full animate-spin shadow-[0_0_60px_rgba(14,165,233,0.1)]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-3 bg-sky-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(14,165,233,1)]" />
                      </div>
                  </div>
                  
                  <div className="text-center space-y-4">
                      <div className="flex flex-col items-center">
                         <h3 className="text-2xl font-black text-white uppercase tracking-[0.5em] animate-pulse">Initializing</h3>
                         <div className="h-1 w-12 bg-sky-500 rounded-full mt-1" />
                      </div>
                      <div className="flex items-center justify-center gap-3">
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Neural Link Stable</span>
                          <div className="w-1 h-1 bg-slate-800 rounded-full" />
                          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">AuraFlow v2.5</span>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full bg-slate-950 overflow-hidden">
      
      {/* 1. MAIN AREA (LEFT) - Balanced Cinema Focus */}
      <div className="flex-none md:flex-1 flex flex-col bg-black md:bg-[#020617] relative overflow-hidden">
          {/* Header (Integrated) - Flexible on Mobile, Floating on Desktop */}
          <div className="relative md:absolute md:top-0 md:left-0 md:right-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl shrink-0 z-20">
              <div className="flex items-center gap-3">
                  <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white transition-colors">
                      <ArrowLeft size={20} />
                  </button>
                  <h1 className="text-sm font-bold text-slate-200 line-clamp-1">{lessonTitle || 'Untitled Lesson'}</h1>
              </div>
              <div className="flex items-center gap-2">
                  {/* Live Heartbeat Session Stats */}
                  {(Number(initialListeningSeconds) > 0 || Number(sessionListeningSeconds) > 0 || Number(sessionShadowingCount) > 0) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        className="flex items-center gap-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mr-2"
                      >
                          <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-[10px] font-black text-emerald-400 font-mono">{formatSessionTime(sessionListeningSeconds)}</span>
                          </div>
                      </motion.div>
                  )}

                  <div className="flex bg-slate-900 border border-white/5 rounded-lg p-0.5">
                      {[1, 1.25, 1.5].map(rate => (
                          <button key={rate} onClick={() => setPlaybackRate(rate)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${playbackRate === rate ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}>
                              {rate}x
                          </button>
                      ))}
                  </div>
                  <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white"><Settings size={20} /></button>
              </div>
          </div>
          
          {/* Video Wrapper - Maximized but constrained to view height */}
          <div className="flex-1 w-full flex flex-col items-center justify-center p-0 md:p-8 lg:p-12">
               <div className="w-full max-w-[1700px] aspect-video md:rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 bg-black relative">
                  <VideoSection />
               </div>
          </div>
      </div>

      {/* Resize Handle (Desktop Only) */}
      <div 
        onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
        }}
        className={`hidden md:block w-1.5 h-full cursor-col-resize hover:bg-sky-500/50 transition-colors z-30 shrink-0 ${isResizing ? 'bg-sky-500' : 'bg-transparent'}`}
      />

      {/* 2. SIDEBAR (RIGHT) - Dynamic width on Desktop, flex-1 on mobile */}
      <div 
        style={{ width: window.innerWidth < 768 ? '100%' : `${sidebarWidth}px` }}
        className="flex-1 md:flex-none md:h-full bg-slate-950 border-l border-white/5 flex flex-col shrink-0 overflow-hidden relative"
      >
          {/* Tabs - Compressed for Mobile Focus */}
          <div className="flex bg-slate-900/50 p-1 m-2 md:m-4 rounded-xl border border-white/5 gap-1">
              {tabs.map(tab => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`flex-1 flex flex-row md:flex-col items-center justify-center gap-2 md:gap-1.5 py-2 md:py-4 rounded-lg transition-all ${
                          activeTab === tab.id 
                          ? 'bg-slate-800 text-sky-400 shadow-lg border border-white/10' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                  >
                      <div className={activeTab === tab.id ? 'scale-110 text-sky-400' : ''}>
                          <div className="md:hidden">
                            <tab.icon size={14} />
                          </div>
                          <div className="hidden md:block">
                            <tab.icon size={18} />
                          </div>
                      </div>
                      <span className="text-[7px] md:text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                  </button>
              ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto px-4 custom-scrollbar mt-2">
              <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
                    {renderPanel()}
                  </motion.div>
              </AnimatePresence>
          </div>

          {/* Sidebar Footer: Ultra-Minimalist Background Progress */}
          <div className="relative p-2 md:p-3 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl overflow-hidden shrink-0">
              {/* Progress Background Layer */}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="absolute inset-y-0 left-0 bg-sky-500/10 pointer-events-none transition-all duration-500"
              />

              <div className="relative flex items-center justify-between gap-3 z-10">
                  <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[10px] font-mono text-sky-400 font-bold leading-none">{progressLine}</span>
                      <span className="text-[8px] text-slate-700 font-black leading-none">/</span>
                      <span className="text-[8px] text-slate-600 font-bold leading-none">{totalLines} L</span>
                      <span className="text-xs font-black text-white/10 italic ml-2 leading-none">{progressPercent}%</span>
                  </div>
                  
                  <button 
                    onClick={() => completeLesson()}
                    disabled={isCompleted}
                    className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm border ${
                        isCompleted 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default' 
                        : 'bg-white text-slate-950 border-white hover:bg-sky-400'
                    }`}
                  >
                    {isCompleted ? (
                        <><Check size={10} strokeWidth={4} /> DONE</>
                    ) : (
                        'MARK DONE'
                    )}
                  </button>
              </div>
          </div>
      </div>

      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
