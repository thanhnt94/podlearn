import React from 'react';
import { 
    LayoutDashboard, 
    History, 
    Dumbbell, 
    BookMarked,
    MessageSquare,
    StickyNote,
    FileText,
    Target,
    Mic2,
    Type,
    Sparkles,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import existing components
import { OverviewPanel } from '../../tabs/OverviewPanel';
import { InsightsPanel } from '../../tabs/InsightsPanel';
import { VocabPanel } from '../../tabs/VocabPanel';
import { NotesPanel } from '../../tabs/NotesPanel';
import { CommunityPanel } from '../../tabs/CommunityPanel';
import { ShadowingPanel } from '../../tabs/ShadowingPanel';
import { DictationPanel } from '../../tabs/DictationPanel';
import { MasteryPanel } from '../../tabs/MasteryPanel';
import { TranscriptBody } from '../../transcript/TranscriptBody';
import { usePlayerStore } from '../../../store/usePlayerStore';

type MainTab = 'Overview' | 'TimeLine' | 'Practice' | 'Vocab';

export const SidebarContainer: React.FC = () => {
    const { 
        activeSidebarTab: activeTab, 
        setActiveSidebarTab: setActiveTab,
        timelineSub,
        setTimelineSub,
        practiceSub,
        setPracticeSub
    } = usePlayerStore();

    const mainTabs = [
        { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'TimeLine', label: 'TimeLine', icon: History },
        { id: 'Practice', label: 'Practice', icon: Dumbbell },
        { id: 'Vocab', label: 'Vocab', icon: BookMarked },
    ];

    return (
        <div className="flex flex-col h-full bg-[#020617] border-l border-white/5 shadow-2xl overflow-hidden font-sans">
            
            {/* ─── Premium Tab Switcher Header ─── */}
            <div className="shrink-0 px-4 pt-4 pb-2 bg-gradient-to-b from-slate-900/50 to-transparent">

                <div className="relative flex p-1 bg-slate-900/80 rounded-2xl border border-white/5 backdrop-blur-md">
                    {mainTabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as MainTab)}
                                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-500 relative z-10 ${
                                    isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                <tab.icon size={18} className={`transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100 opacity-60'}`} />
                                <span className={`text-[8px] font-black uppercase tracking-widest transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                    {tab.label}
                                </span>
                                {isActive && (
                                    <motion.div 
                                        layoutId="activeTabPill"
                                        className="absolute inset-0 bg-white/5 rounded-xl border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Sub-Tab Navigation (Dynamic) ─── */}
            <div className="shrink-0 px-4 py-3">
                <AnimatePresence mode="wait">
                    {activeTab === 'Overview' && (
                        <div />
                    )}
                    {activeTab === 'TimeLine' && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                             <SubTabButton active={timelineSub === 'transcript'} onClick={() => setTimelineSub('transcript')} label="Transcript" icon={<FileText size={12} />} color="sky" />
                             <SubTabButton active={timelineSub === 'notes'} onClick={() => setTimelineSub('notes')} label="My Notes" icon={<StickyNote size={12} />} color="emerald" />
                             <SubTabButton active={timelineSub === 'social'} onClick={() => setTimelineSub('social')} label="Community" icon={<MessageSquare size={12} />} color="pink" />
                        </motion.div>
                    )}
                    {activeTab === 'Practice' && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                             <SubTabButton active={practiceSub === 'shadowing'} onClick={() => setPracticeSub('shadowing')} label="Shadow" icon={<Mic2 size={12} />} color="sky" />
                             <SubTabButton active={practiceSub === 'dictation'} onClick={() => setPracticeSub('dictation')} label="Dictate" icon={<Type size={12} />} color="emerald" />
                             <SubTabButton active={practiceSub === 'mastery'} onClick={() => setPracticeSub('mastery')} label="Mastery" icon={<Target size={12} />} color="amber" />
                             <SubTabButton active={practiceSub === 'ai'} onClick={() => setPracticeSub('ai')} label="AI Insight" icon={<Sparkles size={12} />} color="purple" />
                        </motion.div>
                    )}
                    {activeTab === 'Vocab' && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex items-center justify-between px-1">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500"><BookMarked size={14} /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Word Manager</span>
                             </div>
                             <div className="p-2 text-slate-600 hover:text-white transition-colors cursor-pointer"><Search size={16} /></div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Main Content Area ─── */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${activeTab}-${timelineSub}-${practiceSub}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                        className="h-full w-full overflow-y-auto custom-scrollbar px-4 pb-24"
                    >
                        {activeTab === 'Overview' && (
                            <OverviewPanel />
                        )}

                        {activeTab === 'TimeLine' && (
                            timelineSub === 'transcript' ? <TranscriptBody /> : 
                            timelineSub === 'notes' ? <NotesPanel /> : <CommunityPanel />
                        )}

                        {activeTab === 'Practice' && (
                            practiceSub === 'shadowing' ? <ShadowingPanel /> : 
                            practiceSub === 'dictation' ? <DictationPanel /> : 
                            practiceSub === 'mastery' ? <MasteryPanel /> : <InsightsPanel />
                        )}

                        {activeTab === 'Vocab' && (
                            <VocabPanel />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Shadow removed to prevent button darkening */}
        </div>
    );
};

const SubTabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: React.ReactNode; color: string }> = ({ active, onClick, label, icon, color }) => {
    const colors: Record<string, string> = {
        sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        pink: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                active ? `${colors[color]} shadow-lg shadow-${color}-500/10` : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
            }`}
        >
            {icon}
            {label}
        </button>
    );
};
