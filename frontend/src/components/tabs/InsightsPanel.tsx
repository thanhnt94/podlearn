import React, { useState, useEffect } from 'react';
import { Sparkles, Info, Zap, Loader2, BookOpen, Quote, LayoutList, Play, SkipForward, MessageSquareQuote } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

type SubTab = 'overview' | 'detail';

export const InsightsPanel: React.FC = () => {
    const { 
        aiInsights = [], aiSummary = null,
        activeLineIndex = -1, subtitles = [], videoId = null,
        isPlaying,
        fetchAIInsights, analyzeLine, requestSeek, setPlaying, setMode
    } = usePlayerStore();
    
    const [activeTab, setActiveTab] = useState<SubTab>('overview');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [summaryPolling, setSummaryPolling] = useState(false);
    const [isAnalyzingLine, setIsAnalyzingLine] = useState<number | null>(null);

    const activeLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;
    const currentInsight = aiInsights.find(it => it.index === activeLineIndex);

    // === INIT: Fetch existing insights ===
    useEffect(() => {
        fetchAIInsights();
    }, []);

    // === SHADOWING-LIKE: Auto-pause after sentence ends ===
    useEffect(() => {
        if (activeTab !== 'detail') return;
        setMode('shadowing');
        return () => setMode('watch');
    }, [activeTab]);

    // === SUMMARY POLLING ===
    useEffect(() => {
        if (!summaryPolling) return;
        const interval = setInterval(async () => {
            await fetchAIInsights();
            const store = usePlayerStore.getState();
            if (store.aiSummary || store.aiStatus === 'failed' || store.aiStatus === 'completed') {
                setSummaryPolling(false);
                setIsGeneratingSummary(false);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [summaryPolling]);

    const handleGenerateSummary = async () => {
        if (!videoId || isGeneratingSummary) return;
        setIsGeneratingSummary(true);
        try {
            await axios.post(`/api/ai/insights/${videoId}/analyze`, {}, { withCredentials: true });
            setSummaryPolling(true);
        } catch (e) {
            console.error("Failed to trigger summary analysis", e);
            setIsGeneratingSummary(false);
        }
    };

    const handleAnalyzeLine = async () => {
        if (activeLineIndex === -1 || isAnalyzingLine !== null) return;
        setIsAnalyzingLine(activeLineIndex);
        try {
            await analyzeLine(activeLineIndex);
        } catch (e) {
            console.error("Line analysis failed", e);
        } finally {
            setIsAnalyzingLine(null);
        }
    };

    const handleNextSentence = () => {
        if (activeLineIndex < subtitles.length - 1) {
            const nextLine = subtitles[activeLineIndex + 1];
            requestSeek(nextLine.start, activeLineIndex + 1);
            setTimeout(() => setPlaying(true), 150);
        }
    };

    const handleReplay = () => {
        if (activeLine) {
            requestSeek(activeLine.start);
            setTimeout(() => setPlaying(true), 100);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#020617]/20 backdrop-blur-sm overflow-hidden">
            {/* Sub-Tab Navigation */}
            <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-2xl mx-4 mt-4 border border-white/5">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeTab === 'overview' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <BookOpen size={14} />
                    Tổng quan
                </button>
                <button 
                    onClick={() => setActiveTab('detail')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeTab === 'detail' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <Quote size={14} />
                    Phân tích câu
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                        <motion.div 
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {!aiSummary && !isGeneratingSummary ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center">
                                     <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                                         <Sparkles size={32} className="text-white" />
                                     </div>
                                     <h3 className="text-white font-black text-xl mb-2">Chưa có tóm tắt</h3>
                                     <p className="text-slate-400 text-xs mb-8 max-w-[240px]">
                                         Bấm nút bên dưới để AI quét và tóm tắt toàn bộ nội dung bài học này.
                                     </p>
                                     <button 
                                        onClick={handleGenerateSummary}
                                        disabled={isGeneratingSummary}
                                        className="bg-white text-slate-950 px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                     >
                                         <Zap size={16} />
                                         Phân tích tổng quan
                                     </button>
                                </div>
                            ) : isGeneratingSummary && !aiSummary ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                                    <Loader2 className="animate-spin text-purple-500" size={40} />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI đang phân tích bài học...</p>
                                    <p className="text-xs text-slate-600">Quá trình này có thể mất vài giây</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="relative bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-purple-500/10 transition-colors">
                                            <Info size={120} />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-6 text-purple-400">
                                                <LayoutList size={16} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Lesson Overview</span>
                                            </div>
                                            <div className="ai-markdown text-slate-300 text-sm leading-relaxed">
                                                <ReactMarkdown>{aiSummary || ''}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl">
                                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 text-sm">
                                            <Sparkles size={18} />
                                        </div>
                                        <p className="text-[11px] text-sky-500/70 font-bold leading-snug">
                                            Chuyển sang tab "Phân tích câu" để xem giải thích chi tiết cho từng dòng khi nghe.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        /* === DETAIL TAB === */
                        <motion.div 
                            key="detail"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full flex flex-col"
                        >
                            {!activeLine ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                                    <Play size={40} className="mb-4 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Bấm Play để bắt đầu</p>
                                    <p className="text-[10px] text-slate-600 mt-2">Video sẽ tự động dừng sau mỗi câu</p>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-20">
                                    {/* Active Sentence Card */}
                                    <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
                                        <div className="flex justify-between items-start mb-6">
                                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500/60">
                                                 Câu {activeLineIndex + 1} / {subtitles.length}
                                             </span>
                                             <button 
                                                onClick={handleReplay}
                                                className="p-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 rounded-full transition-all"
                                             >
                                                 <Play size={16} fill="currentColor" />
                                             </button>
                                        </div>
                                        <h3 className="text-white text-xl md:text-2xl font-bold leading-tight mb-3">
                                            {activeLine.text}
                                        </h3>
                                        <p className="text-slate-400 italic text-sm">{activeLine.trans}</p>
                                    </div>

                                    {/* ── Analysis / Trigger ── */}
                                    <AnimatePresence mode="wait">
                                        {isPlaying ? (
                                            <motion.div
                                                key="listening"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center justify-center gap-3 py-8"
                                            >
                                                <div className="flex gap-1">
                                                    {[0, 1, 2, 3, 4].map(i => (
                                                        <motion.div
                                                            key={i}
                                                            animate={{ scaleY: [1, 2.5, 1] }}
                                                            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                                                            className="w-1 h-3 bg-sky-500 rounded-full origin-bottom"
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Đang nghe...</span>
                                            </motion.div>
                                        ) : currentInsight ? (
                                            <motion.div 
                                                key={`result-${activeLineIndex}`}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="grid gap-4"
                                            >
                                                <AnalysisSection title="Giải thích ngữ pháp" content={currentInsight.grammar} color="blue" />
                                                <AnalysisSection title="Sắc thái & Phong cách" content={currentInsight.nuance} color="emerald" />
                                                <AnalysisSection title="Ngữ cảnh sử dụng" content={currentInsight.context} color="amber" />
                                                
                                                {/* Similar Sentences Section */}
                                                {currentInsight.similar && (
                                                    <div className="p-6 rounded-2xl border border-purple-500/10 bg-purple-500/5">
                                                        <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider text-purple-400 bg-purple-400/5">
                                                            <MessageSquareQuote size={12} />
                                                            Câu tương tự
                                                        </div>
                                                        <div className="ai-markdown text-[13px] text-slate-300 leading-relaxed font-medium">
                                                            <ReactMarkdown>{currentInsight.similar}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Navigation */}
                                                <div className="flex gap-3 pt-4">
                                                    <button 
                                                        onClick={handleReplay}
                                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm"
                                                    >
                                                        <Play size={16} /> Nghe lại
                                                    </button>
                                                    <button 
                                                        onClick={handleNextSentence}
                                                        className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-sky-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                                                    >
                                                        <SkipForward size={16} /> Câu tiếp
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div 
                                                key={`analyze-${activeLineIndex}`}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="py-8 flex flex-col items-center justify-center bg-slate-900/30 border border-dashed border-white/10 rounded-3xl"
                                            >
                                                {isAnalyzingLine === activeLineIndex ? (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <Loader2 className="animate-spin text-sky-500" size={32} />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Neuro-Parsing...</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-6">
                                                        <div className="p-4 bg-sky-500/10 rounded-full text-sky-500">
                                                            <Zap size={24} />
                                                        </div>
                                                        <div className="text-center px-6">
                                                            <p className="text-sm font-bold text-white mb-1">Chưa có phân tích câu này</p>
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
                                                                Bóc tách ngữ pháp, sắc thái và ngữ cảnh
                                                            </p>
                                                        </div>
                                                        <button 
                                                            onClick={handleAnalyzeLine}
                                                            className="bg-sky-500 text-slate-950 px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-sky-500/20 active:scale-95 transition-all"
                                                        >
                                                            Phân tích bằng AI
                                                        </button>
                                                        
                                                        <div className="flex gap-3 w-full px-6 pt-4 border-t border-white/5">
                                                            <button 
                                                                onClick={handleReplay}
                                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs text-slate-400"
                                                            >
                                                                <Play size={14} /> Nghe lại
                                                            </button>
                                                            <button 
                                                                onClick={handleNextSentence}
                                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs text-slate-400"
                                                            >
                                                                <SkipForward size={14} /> Bỏ qua
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="h-12 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none sticky bottom-0" />
        </div>
    );
};

/* ── Markdown-enabled Analysis Card ── */
const AnalysisSection: React.FC<{ 
    title: string; 
    content: string; 
    color: 'blue' | 'emerald' | 'amber';
}> = ({ title, content, color }) => {
    if (!content) return null;
    const colors = {
        blue: 'text-blue-400 bg-blue-400/5 border-blue-500/10',
        emerald: 'text-emerald-400 bg-emerald-400/5 border-emerald-500/10',
        amber: 'text-amber-400 bg-amber-400/5 border-amber-500/10'
    };
    const borderColor = {
        blue: 'border-blue-500/10',
        emerald: 'border-emerald-500/10',
        amber: 'border-amber-500/10'
    };
    return (
        <div className={`p-6 rounded-2xl border bg-slate-900/30 ${borderColor[color]}`}>
            <div className={`mb-3 inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${colors[color]}`}>
                {title}
            </div>
            <div className="ai-markdown text-[13px] text-slate-300 leading-relaxed font-medium">
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>
        </div>
    );
};
