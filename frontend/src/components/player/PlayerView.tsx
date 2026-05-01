import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Lock, CreditCard, RefreshCw, Settings, MoveHorizontal, Scissors, Edit2, Save, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoSection } from './VideoSection';
import { HandsFreeEngine } from './HandsFreeEngine';
import { PodcastOverlay } from './PodcastOverlay';
import { SidebarContainer } from './sidebar/SidebarContainer';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import { SettingsDrawer } from '../layout/SettingsDrawer';
import { SubtitleSyncStudio } from './SubtitleSyncStudio';
import { LearningFocusBar } from './LearningFocusBar';
import { VocabStudio } from './VocabStudio';
import { ExportModal } from './ExportModal';
import { useSwipe } from '../../hooks/useSwipe';



interface PlayerViewProps {
  initialStudioMode?: boolean;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ initialStudioMode = false }) => {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isSyncStudioOpen = initialStudioMode;
  
  const { 
    isLoaded, videoId, lessonTitle, lessonId,
    playbackRate, setPlaybackRate,
    activeLineIndex, subtitles,
    sidebarWidth, setSidebarWidth,
    isPlaying, addListeningTime, flushTrackingData,
    handsFreeModeEnabled, toggleHandsFreeMode, handsFreeStatus, handsFreeProgress,
    isLocked, lockMessage,
    isVocabStudioOpen, setVocabStudioOpen,
    requestSeek, currentTime,
    activeSidebarTab, isEditingCurated, setEditingCurated,
    curatedContent, draftCuratedContent, setDraftCuratedContent, updateCuratedContent
  } = usePlayerStore();

  const { user } = useAppStore();
  const isAdmin = user?.is_admin;

  const handleStartEdit = () => {
    setDraftCuratedContent(curatedContent);
    setEditingCurated(true);
  };

  const handleCancelEdit = () => {
    setEditingCurated(false);
  };

  const handleSaveEdit = async () => {
    try {
        await updateCuratedContent(draftCuratedContent);
        setEditingCurated(false);
    } catch (e) {
        alert("Lỗi khi lưu nội dung!");
    }
  };

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => requestSeek(currentTime + 5),
    onSwipeRight: () => requestSeek(currentTime - 5),
    threshold: 60
  });


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
      // Handle locked state before full load if necessary
      if (isLocked) {
          return (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 px-6">
                  <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
                      <div className="mx-auto w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 border border-amber-500/20">
                          <Lock size={40} />
                      </div>
                      <div className="space-y-2">
                          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Video đã khóa</h2>
                          <p className="text-slate-400 text-sm leading-relaxed">{lockMessage}</p>
                      </div>
                      <div className="pt-4 flex flex-col gap-3">
                          <button 
                             onClick={() => navigate('/')}
                             className="w-full py-4 bg-amber-500 text-slate-950 font-black rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                          >
                             <CreditCard size={18} /> NÂNG CẤP VIP NGAY
                          </button>
                          <button 
                             onClick={() => navigate('/')}
                             className="w-full py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
                          >
                             Quay lại trang chủ
                          </button>
                      </div>
                  </div>
              </div>
          );
      }

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
    <div 
      className="flex-1 flex flex-col md:flex-row h-full bg-slate-950 overflow-hidden relative"
      {...swipeHandlers}
    >
      {/* Mid-watch Lockout Overlay */}
      <AnimatePresence>
          {isLocked && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-6"
              >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden"
                  >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
                      <div className="mx-auto w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 border border-amber-500/20">
                          <Lock size={40} />
                      </div>
                      <div className="space-y-2">
                          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Hết hạn học thử</h2>
                          <p className="text-slate-400 text-sm leading-relaxed">{lockMessage}</p>
                      </div>
                      <div className="pt-4 flex flex-col gap-3">
                          <button 
                             onClick={() => navigate('/')}
                             className="w-full py-4 bg-amber-500 text-slate-950 font-black rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                          >
                             <CreditCard size={18} /> NÂNG CẤP VIP NGAY
                          </button>
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* 1. MAIN AREA (LEFT) - Balanced Cinema Focus */}
      <div className="flex-none md:flex-1 flex flex-col bg-black md:bg-[#020617] relative overflow-hidden z-10 min-h-0">
          {/* Header (Integrated) - Flexible on Mobile, Floating on Desktop */}
          <div className="relative w-full flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl shrink-0 z-20">
              <div className="flex items-center gap-3">
                  <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white transition-colors">
                      <ArrowLeft size={20} />
                  </button>
                  <h1 className="text-sm font-bold text-slate-200 line-clamp-1">{lessonTitle || 'Untitled Lesson'}</h1>
              </div>
              <div className="flex items-center gap-2">

                  {/* Hands-Free Toggle (Header) */}
                  <button 
                      onClick={toggleHandsFreeMode}
                      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest transition-all ${
                          handsFreeModeEnabled 
                          ? 'bg-sky-500 text-slate-950 shadow-[0_0_20px_rgba(14,165,233,0.3)]' 
                          : 'bg-slate-900 text-slate-500 hover:text-white border border-white/5'
                      }`}
                  >
                      <RefreshCw size={12} className={handsFreeStatus === 'generating' ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">HANDS-FREE</span>
                      {handsFreeStatus === 'generating' && (
                          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-slate-950/20 rounded-full overflow-hidden">
                              <div 
                                  className="h-full bg-slate-950/40 transition-all duration-300" 
                                  style={{ width: `${handsFreeProgress * 100}%` }}
                              />
                          </div>
                      )}
                  </button>

                  <div className="hidden md:flex bg-slate-900 border border-white/5 rounded-lg p-0.5">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                          <button key={rate} onClick={() => setPlaybackRate(rate)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${playbackRate === rate ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}>
                              {rate === 1 ? '1x' : rate}
                          </button>
                      ))}
                  </div>
                  <button 
                    onClick={() => navigate(`/player/lesson/syncstudio/${lessonId}`)} 
                    className="p-2 text-slate-400 hover:text-sky-400 transition-colors bg-slate-900 border border-white/5 rounded-lg"
                    title="Open Sync Studio"
                  >
                      <MoveHorizontal size={20} />
                  </button>
                  <button 
                    onClick={() => setVocabStudioOpen(true)} 
                    className="p-2 text-slate-400 hover:text-amber-400 transition-colors bg-slate-900 border border-white/5 rounded-lg"
                    title="Open Vocab Studio"
                  >
                      <Scissors size={20} />
                  </button>
                  <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors">
                      <Settings size={20} />
                  </button>
              </div>
          </div>
          
          {/* Video Wrapper - Maximized but constrained to view height */}
          <div className="w-full aspect-video md:aspect-auto md:flex-1 flex flex-col items-center justify-center p-0 md:p-4 relative min-h-0 overflow-hidden z-10">
               <div className="w-full h-full max-w-[1700px] md:rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border-b border-white/5 md:border bg-black relative">
                  {handsFreeModeEnabled ? (
                      <PodcastOverlay />
                  ) : (
                      <VideoSection />
                  )}
               </div>
          </div>
          
          {/* Focus Area (Analysis) */}
          <div className="shrink-0 relative z-[500] h-[110px]">
              <LearningFocusBar />
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

      <div 
        style={{ width: window.innerWidth < 768 ? '100%' : `${sidebarWidth}px` }}
        className="flex-1 md:flex-none md:h-full bg-slate-950 border-l border-white/5 flex flex-col shrink-0 overflow-hidden relative"
      >
          <SidebarContainer />

          {/* Sidebar Footer: High-Visibility Actions */}
          <div className="relative p-2.5 border-t border-white/20 bg-[#0f172a] z-50 shrink-0">
              <div className="flex items-center justify-between gap-4">
                  {activeSidebarTab !== 'Overview' && (
                    <div className="flex flex-col gap-0.5 px-1 min-w-[70px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-sky-400 font-black">{progressLine}</span>
                          <span className="text-[10px] text-slate-600 font-black">/</span>
                          <span className="text-[10px] text-slate-400 font-black">{totalLines}</span>
                        </div>
                        <div className="text-[10px] font-black text-sky-500/40 italic">{progressPercent}% DONE</div>
                    </div>
                  )}
                  
                  {isAdmin && activeSidebarTab === 'Overview' && (
                    <div className="flex-1">
                      {isEditingCurated ? (
                        <div className="flex gap-2">
                           <button 
                             onClick={handleCancelEdit}
                             style={{ backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569' }}
                             className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-125 transition-all flex items-center justify-center gap-2"
                           >
                             <X size={12} /> Hủy
                           </button>
                           <button 
                             onClick={handleSaveEdit}
                             style={{ backgroundColor: '#059669', color: '#ffffff', boxShadow: '0 0 15px rgba(5,150,105,0.4)' }}
                             className="flex-[2.5] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#10b981] transition-all flex items-center justify-center gap-2 shadow-lg"
                           >
                             <Save size={12} /> Lưu thay đổi
                           </button>
                        </div>
                      ) : (
                        <button 
                          onClick={handleStartEdit}
                          style={{ backgroundColor: '#0284c7', color: '#ffffff', boxShadow: '0 0 20px rgba(2,132,199,0.3)' }}
                          className="w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#0ea5e9] transition-all flex items-center justify-center gap-2 shadow-xl"
                        >
                          <Edit2 size={12} /> Chỉnh sửa nội dung
                        </button>
                      )}
                    </div>
                  )}
              </div>
          </div>
      </div>

      <HandsFreeEngine />
      <VocabStudio isOpen={isVocabStudioOpen} onClose={() => setVocabStudioOpen(false)} />
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AnimatePresence>
        {isSyncStudioOpen && (
          <SubtitleSyncStudio isOpen={isSyncStudioOpen} onClose={() => navigate(`/player/lesson/${lessonId}`)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isExportOpen && (
          <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
