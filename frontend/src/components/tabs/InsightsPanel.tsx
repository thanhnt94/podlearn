import React, { useState, useEffect } from 'react';
import { 
    Sparkles, Info, Zap, Loader2, BookOpen, LayoutList, Play, 
    SkipForward, MessageSquareQuote, ChevronLeft, ChevronRight,
    Languages, Globe, AlertTriangle, Lightbulb
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface CardData {
    title: string;
    content: string;
    color: string;
    icon: React.ReactNode;
}

export const InsightsPanel: React.FC = () => {
    const { 
        aiInsights = [], activeLineIndex = -1, subtitles = [],
        isPlaying, fetchAIInsights, analyzeLine, requestSeek, setPlaying, setMode
    } = usePlayerStore();
    
    const [isAnalyzingLine, setIsAnalyzingLine] = useState<number | null>(null);
    const [cardIndex, setCardIndex] = useState(0);
    const [flipDirection, setFlipDirection] = useState(1); // 1 = next, -1 = prev

    const activeLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;
    const currentInsight = aiInsights.find(it => it.index === activeLineIndex);

    // Reset card index when sentence changes
    useEffect(() => { setCardIndex(0); }, [activeLineIndex]);

    // Build cards array from current insight (Up to 8 cards)
    const cards: CardData[] = currentInsight ? [
        { title: 'Dịch nghĩa', content: currentInsight.short || '', color: 'blue', icon: <Languages size={14} /> },
        { title: 'Giải thích ngữ pháp', content: currentInsight.grammar || '', color: 'indigo', icon: <BookOpen size={14} /> },
        { title: 'Từ vựng trọng tâm', content: currentInsight.vocabulary || '', color: 'emerald', icon: <LayoutList size={14} /> },
        { title: 'Sắc thái & Phong cách', content: currentInsight.nuance || '', color: 'sky', icon: <Info size={14} /> },
        { title: 'Câu tương tự', content: currentInsight.similar || '', color: 'purple', icon: <MessageSquareQuote size={14} /> },
        { title: 'Bối cảnh văn hóa', content: currentInsight.culture || '', color: 'amber', icon: <Globe size={14} /> },
        { title: 'Mẹo ghi nhớ', content: currentInsight.hack || '', color: 'orange', icon: <Lightbulb size={14} /> },
        { title: 'Lỗi thường gặp', content: currentInsight.mistakes || '', color: 'rose', icon: <AlertTriangle size={14} /> },
    ].filter(c => c.content) : [];

    const handlePrevCard = () => { setFlipDirection(-1); setCardIndex(i => Math.max(0, i - 1)); };
    const handleNextCard = () => { setFlipDirection(1); setCardIndex(i => Math.min(cards.length - 1, i + 1)); };

    // === INIT ===
    useEffect(() => { 
        fetchAIInsights(); 
        setMode('shadowing');
        return () => setMode('watch');
    }, []);

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

    const colorMap: Record<string, { badge: string; border: string; dot: string }> = {
        blue:    { badge: 'text-blue-400 bg-blue-400/10', border: 'border-blue-500/15', dot: 'bg-blue-400' },
        indigo:  { badge: 'text-indigo-400 bg-indigo-400/10', border: 'border-indigo-500/15', dot: 'bg-indigo-400' },
        emerald: { badge: 'text-emerald-400 bg-emerald-400/10', border: 'border-emerald-500/15', dot: 'bg-emerald-400' },
        sky:     { badge: 'text-sky-400 bg-sky-400/10', border: 'border-sky-500/15', dot: 'bg-sky-400' },
        purple:  { badge: 'text-purple-400 bg-purple-400/10', border: 'border-purple-500/15', dot: 'bg-purple-400' },
        amber:   { badge: 'text-amber-400 bg-amber-400/10', border: 'border-amber-500/15', dot: 'bg-amber-400' },
        orange:  { badge: 'text-orange-400 bg-orange-400/10', border: 'border-orange-500/15', dot: 'bg-orange-400' },
        rose:    { badge: 'text-rose-400 bg-rose-400/10', border: 'border-rose-500/15', dot: 'bg-rose-400' },
    };

    return (
        <div className="flex flex-col h-full bg-[#020617]/20 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 pt-6 pb-2">
                 <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Sparkles size={16} className="text-white" />
                 </div>
                  <div>
                    <h2 className="text-white font-black text-sm uppercase tracking-widest text-[11px]">AI Sentence Analysis</h2>
                    <div className="flex items-center gap-2">
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Shadowing Learning Flow</p>
                        {currentInsight?.grammar?.includes('[MOCK]') && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-tighter rounded-md border border-amber-500/30 animate-pulse">
                                Mock Mode
                            </span>
                        )}
                    </div>
                  </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-6">
                <AnimatePresence mode="wait">
                    {!activeLine ? (
                        <motion.div 
                            key="no-active-line"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center"
                        >
                            <div className="w-20 h-20 rounded-full border border-slate-800 flex items-center justify-center mb-6">
                                <Play size={32} className="opacity-20 ml-1" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest">Bấm Play để bắt đầu</p>
                            <p className="text-[10px] text-slate-600 mt-2 uppercase font-black tracking-widest">Auto-pause shadowing active</p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="active-line-content"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex-1 flex flex-col overflow-hidden gap-6"
                        >
                            <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 relative overflow-hidden shrink-0 group">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)]" />
                                <div className="flex justify-between items-start mb-4">
                                     <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-500/60">
                                         Sentence {activeLineIndex + 1} of {subtitles.length}
                                     </span>
                                     <div className="flex gap-2">
                                         <button 
                                            onClick={handleAnalyzeLine}
                                            disabled={isAnalyzingLine !== null}
                                            className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-full transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                                            title="Phân tích lại câu này"
                                         >
                                             {isAnalyzingLine === activeLineIndex ? (
                                                 <Loader2 size={14} className="animate-spin" />
                                             ) : (
                                                 <Zap size={14} />
                                             )}
                                             Refresh
                                         </button>
                                         <button 
                                            onClick={handleReplay}
                                            className="p-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 rounded-full transition-all"
                                         >
                                             <Play size={16} fill="currentColor" />
                                         </button>
                                     </div>
                                </div>
                                <h3 className="text-white text-xl font-bold leading-tight mb-3 group-hover:text-sky-100 transition-colors">
                                    {activeLine.text}
                                </h3>
                                <p className="text-slate-400 italic text-sm font-medium">{activeLine.trans}</p>
                            </div>

                            <div className="flex-1 flex flex-col overflow-hidden">
                                <AnimatePresence mode="wait">
                                    {isPlaying ? (
                                        <motion.div
                                            key="listening"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex-1 flex flex-col items-center justify-center gap-4"
                                        >
                                            <div className="flex gap-1.5 items-end h-8">
                                                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                                                    <motion.div
                                                        key={i}
                                                        animate={{ scaleY: [1, 2.5, 1.2, 2.8, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1 }}
                                                        className="w-1 bg-sky-500/60 rounded-full origin-bottom"
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Video playing...</span>
                                        </motion.div>
                                    ) : currentInsight && cards.length > 0 ? (
                                        <motion.div 
                                            key={`carousel-${activeLineIndex}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex-1 flex flex-col overflow-hidden"
                                        >
                                            {/* ─── Carousel Controls (Top) ─── */}
                                            <div className="flex items-center justify-between pb-4 shrink-0">
                                                <button
                                                    onClick={handlePrevCard}
                                                    disabled={cardIndex === 0}
                                                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-10 disabled:cursor-not-allowed transition-all active:scale-90"
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <div className="flex gap-2">
                                                    {cards.map((card, i) => (
                                                        <button 
                                                            key={i} 
                                                            onClick={() => { setFlipDirection(i > cardIndex ? 1 : -1); setCardIndex(i); }}
                                                            className={`h-2 rounded-full transition-all duration-300 ${
                                                                i === cardIndex ? `w-8 ${colorMap[card.color]?.dot || 'bg-white'}` : 'w-2 bg-slate-800 hover:bg-slate-700'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={handleNextCard}
                                                    disabled={cardIndex === cards.length - 1}
                                                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-10 disabled:cursor-not-allowed transition-all active:scale-90"
                                                >
                                                    <ChevronRight size={20} />
                                                </button>
                                            </div>

                                            {/* Card Flipper Area */}
                                            <div className="flex-1 overflow-hidden rounded-2xl min-h-0">
                                                <AnimatePresence mode="wait" custom={flipDirection}>
                                                    <motion.div
                                                        key={cardIndex}
                                                        custom={flipDirection}
                                                        variants={{
                                                            enter: (d: number) => ({ x: d > 0 ? 100 : -100, opacity: 0 }),
                                                            center: { x: 0, opacity: 1 },
                                                            exit: (d: number) => ({ x: d > 0 ? -100 : 100, opacity: 0 }),
                                                        }}
                                                        initial="enter"
                                                        animate="center"
                                                        exit="exit"
                                                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                                        className={`h-full overflow-y-auto custom-scrollbar p-8 rounded-3xl border bg-slate-900/40 ${colorMap[cards[cardIndex]?.color]?.border || 'border-white/5'}`}
                                                    >
                                                        <div className={`mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${colorMap[cards[cardIndex]?.color]?.badge || ''}`}>
                                                            {cards[cardIndex]?.icon}
                                                            {cards[cardIndex]?.title}
                                                        </div>
                                                        <div className="ai-markdown prose prose-invert max-w-none text-[14px] text-slate-200 leading-relaxed font-medium prose-headings:text-white prose-strong:text-sky-400 prose-code:text-emerald-400 prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-white/5 prose-li:my-1 prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:p-2 prose-th:bg-white/5 prose-td:border prose-td:border-white/10 prose-td:p-2">
                                                            <ReactMarkdown 
                                                                remarkPlugins={[remarkGfm]} 
                                                                rehypePlugins={[rehypeRaw]}
                                                            >
                                                                {cards[cardIndex]?.content || ''}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </motion.div>
                                                </AnimatePresence>
                                            </div>

                                            <div className="flex gap-4 pt-4 shrink-0">
                                                <button onClick={handleReplay} className="flex-1 py-4 bg-slate-900/40 hover:bg-slate-900/60 border border-white/5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all"><Play size={16} /> Nghe lại</button>
                                                <button onClick={handleNextSentence} className="flex-1 py-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-sky-500/20 transition-all flex items-center justify-center gap-2"><SkipForward size={16} /> Câu tiếp</button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key={`analyze-${activeLineIndex}`}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="flex-1 flex flex-col items-center justify-center bg-slate-900/30 border border-dashed border-white/10 rounded-3xl"
                                        >
                                            {isAnalyzingLine === activeLineIndex ? (
                                                <div className="flex flex-col items-center gap-5">
                                                    <Loader2 className="animate-spin text-sky-500" size={40} />
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deep Neural Parsing...</p>
                                                        <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold">Building 8 semantic layers</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-8 px-10 text-center">
                                                    <div className="relative">
                                                        <div className="absolute inset-0 bg-sky-500 blur-2xl opacity-20 animate-pulse" />
                                                        <div className="relative p-6 bg-sky-500/10 rounded-full text-sky-500 border border-sky-500/20"><Zap size={32} /></div>
                                                    </div>
                                                    <div>
                                                        <p className="text-md font-bold text-white mb-2 uppercase tracking-wide">Chưa có phân tích</p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Khai phá 8 lớp kiến thức AI.</p>
                                                    </div>
                                                    <button onClick={handleAnalyzeLine} className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-sky-500/40 transition-all w-full">Phân tích 8 thẻ</button>
                                                    <div className="flex gap-4 w-full pt-8 border-t border-white/5">
                                                        <button onClick={handleReplay} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">Replay</button>
                                                        <button onClick={handleNextSentence} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">Skip</button>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div className="h-6 shrink-0" />
        </div>
    );
};
