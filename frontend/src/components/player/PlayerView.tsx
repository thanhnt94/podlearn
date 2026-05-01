import React, { useState, useEffect } from 'react';
import { 
    Mic2, FileText, MessageSquare, BookOpen,
    ArrowLeft, Settings, Check, Sparkles, RefreshCw, MoveHorizontal,
    Lock, CreditCard, Scissors, Download, Layout, Edit2, Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoSection } from './VideoSection';
import { HandsFreeEngine } from './HandsFreeEngine';
import { PodcastOverlay } from './PodcastOverlay';
import { TranscriptBody } from '../transcript/TranscriptBody';
import { ShadowingPanel } from '../tabs/ShadowingPanel';
import { NotesPanel } from '../tabs/NotesPanel';
import { VocabPanel } from '../tabs/VocabPanel';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import { SettingsDrawer } from '../layout/SettingsDrawer';
import { InsightsPanel } from '../tabs/InsightsPanel';
import { CommunityPanel } from '../tabs/CommunityPanel';
import { SubtitleSyncStudio } from './SubtitleSyncStudio';
import { LearningFocusBar } from './LearningFocusBar';
import { VocabStudio } from './VocabStudio';
import { ExportModal } from './ExportModal';
import { useSwipe } from '../../hooks/useSwipe';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { DictationPanel } from '../tabs/DictationPanel';
import { MasteryPanel } from '../tabs/MasteryPanel';

type TabType = 'overview' | 'study' | 'practice' | 'insights';

interface PlayerViewProps {
  initialStudioMode?: boolean;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ initialStudioMode = false }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const isSyncStudioOpen = initialStudioMode;
  const [isResizing, setIsResizing] = useState(false);
  
  const { 
    isLoaded, videoId, lessonTitle, lessonId,
    playbackRate, setPlaybackRate,
    activeLineIndex, subtitles,
    isCompleted, completeLesson,
    sidebarWidth, setSidebarWidth,
    isPlaying, addListeningTime, flushTrackingData,
    handsFreeModeEnabled, toggleHandsFreeMode, handsFreeStatus, handsFreeProgress,
    isLocked, lockMessage,
    isVocabStudioOpen, setVocabStudioOpen,
    requestSeek, currentTime
  } = usePlayerStore();

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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Layout },
    { id: 'study', label: 'Study', icon: BookOpen },
    { id: 'practice', label: 'Practice', icon: Mic2 },
    { id: 'insights', label: 'Insights', icon: Sparkles },
  ];

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPanel />;
      case 'study': return <StudyPanelGroup onExport={() => setIsExportOpen(true)} />;
      case 'practice': return <PracticePanel />;
      case 'insights': return <InsightsPanelGroup />;
      default: return <OverviewPanel />;
    }
  };

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

      {/* 2. SIDEBAR (RIGHT) - Dynamic width on Desktop, flex-1 on mobile */}
      <div 
        style={{ width: window.innerWidth < 768 ? '100%' : `${sidebarWidth}px` }}
        className="flex-1 md:flex-none md:h-full bg-slate-950 border-l border-white/5 flex flex-col shrink-0 overflow-hidden relative"
      >
          <div className="flex bg-slate-900/50 p-1 m-2 md:m-4 rounded-xl border border-white/5 gap-1 shrink-0">
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
                      <tab.icon size={18} strokeWidth={2.5} />
                      <span className="text-[7px] md:text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                  </button>
              ))}
          </div>

          {/* Panel Content - Removed scrolling from here to allow panels to handle it */}
          <div className="flex-1 flex flex-col min-h-0 mt-2">
              <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeTab} 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -5 }} 
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
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
const StudyPanelGroup = ({ onExport }: { onExport: () => void }) => {
    const [sub, setSub] = useState<'read' | 'notes'>('read');
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pb-3 flex gap-2 items-center shrink-0">
                <button 
                    onClick={() => setSub('read')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${sub === 'read' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    <FileText size={14} /> Transcript
                </button>
                <button 
                    onClick={() => setSub('notes')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${sub === 'notes' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    <MessageSquare size={14} /> My Notes
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                {sub === 'read' ? <TranscriptBody /> : <NotesPanel />}
            </div>
            {/* Fixed Footer for Export */}
            <div className="p-4 bg-slate-950/50 border-t border-white/5 shrink-0">
                <button 
                    onClick={onExport}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
                >
                    <Download size={16} /> Export Script (Docx)
                </button>
            </div>
        </div>
    );
};

const PracticePanel = () => {
    const [sub, setSub] = useState<'shadowing' | 'vocab' | 'dictation' | 'mastery'>('shadowing');
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pb-3 flex gap-2 items-center shrink-0 flex-wrap">
                <button 
                    onClick={() => setSub('shadowing')}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sub === 'shadowing' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Shadowing
                </button>
                <button 
                    onClick={() => setSub('dictation')}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sub === 'dictation' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Dictation
                </button>
                <button 
                    onClick={() => setSub('mastery')}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sub === 'mastery' ? 'bg-orange-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Mastery
                </button>
                <button 
                    onClick={() => setSub('vocab')}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${sub === 'vocab' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Vocab
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                {sub === 'shadowing' && <ShadowingPanel />}
                {sub === 'dictation' && <DictationPanel />}
                {sub === 'mastery' && <MasteryPanel />}
                {sub === 'vocab' && <VocabPanel />}
            </div>
        </div>
    );
};

const InsightsPanelGroup = () => {
    const [sub, setSub] = useState<'ai' | 'social'>('ai');
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pb-3 flex gap-2 items-center shrink-0">
                <button 
                    onClick={() => setSub('ai')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'ai' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    AI Analyst
                </button>
                <button 
                    onClick={() => setSub('social')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'social' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Community
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                {sub === 'ai' ? <InsightsPanel /> : <CommunityPanel />}
            </div>
        </div>
    );
};

const OverviewPanel = () => {
    const { curatedContent, updateCuratedContent } = usePlayerStore();
    const [sub, setSub] = useState<'overview' | 'grammar' | 'vocab'>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(curatedContent);
    const { user } = useAppStore();
    const isAdmin = user?.is_admin;

    useEffect(() => {
        setEditedContent(curatedContent);
    }, [curatedContent]);

    const handleSave = async () => {
        try {
            await updateCuratedContent(editedContent);
            setIsEditing(false);
        } catch (e) {
            alert("Lỗi khi lưu nội dung!");
        }
    };

    const renderContent = (key: 'overview' | 'grammar' | 'vocabulary') => {
        const text = curatedContent[key];
        if (isEditing) {
            return (
                <textarea 
                    className="w-full h-[400px] bg-slate-900 border border-white/10 rounded-xl p-4 text-slate-300 font-sans text-sm focus:outline-none focus:border-sky-500 transition-colors"
                    value={editedContent[key]}
                    onChange={(e) => setEditedContent(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Nhập nội dung ${sub}...`}
                />
            );
        }
        
        if (!text) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                    <BookOpen size={40} strokeWidth={1} className="mb-4 opacity-20" />
                    <p className="text-xs uppercase tracking-widest font-black">Chưa có nội dung tổng hợp</p>
                </div>
            );
        }

        return (
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed font-sans prose-headings:text-white prose-strong:text-sky-400 prose-code:text-emerald-400 prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-white/5 prose-li:my-1 prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:p-2 prose-th:bg-white/5 prose-td:border prose-td:border-white/10 prose-td:p-2">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                >
                    {text}
                </ReactMarkdown>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pb-3 flex gap-2 items-center shrink-0">
                <button 
                    onClick={() => setSub('overview')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'overview' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Tổng quan
                </button>
                <button 
                    onClick={() => setSub('grammar')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'grammar' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Ngữ pháp
                </button>
                <button 
                    onClick={() => setSub('vocab')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'vocab' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Từ vựng
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                {renderContent(sub === 'vocab' ? 'vocabulary' : sub)}
            </div>

            {isAdmin && (
                <div className="p-4 border-t border-white/5 bg-slate-950/50 flex justify-end shrink-0">
                    {isEditing ? (
                        <div className="flex gap-2 w-full">
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-1 py-3 bg-sky-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-400 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={14} /> Lưu thay đổi
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="w-full py-3 bg-white/5 text-slate-400 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            <Edit2 size={14} /> Chỉnh sửa nội dung (Admin)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
