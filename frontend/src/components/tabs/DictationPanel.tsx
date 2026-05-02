import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Send, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';

export const DictationPanel: React.FC = () => {
    const { 
        subtitles, activeLineIndex, requestSeek, setPlaying, isPlaying, originalLang, setMode 
    } = usePlayerStore();
    
    const [input, setInput] = useState('');
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const activeLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;

    const lastSeekIndexRef = useRef(-1);
    // Reset when line changes
    useEffect(() => {
        setMode('shadowing');
        return () => setMode('watch');
    }, [setMode]);

    useEffect(() => {
        if (!activeLine || activeLineIndex === lastSeekIndexRef.current) return;
        
        lastSeekIndexRef.current = activeLineIndex;
        setInput('');
        setIsRevealed(false);
        setIsSubmitted(false);
        
        // Only seek if we are far from the start (prevents infinite loop if seek triggers re-render)
        requestSeek(activeLine.start, activeLineIndex);
        setTimeout(() => setPlaying(true), 150);
    }, [activeLineIndex, activeLine, requestSeek, setPlaying]);

    const handleReplay = () => {
        if (activeLine) {
            requestSeek(activeLine.start, activeLineIndex);
            setTimeout(() => setPlaying(true), 100);
        }
    };

    const normalizeText = (text: string) => {
        // First clean the subtitle markers
        let cleaned = text.replace(/\s*\[[^\]]*\]\s*/g, '').replace(/\s*[|/]\s*/g, '').trim();
        // Remove punctuation
        let normalized = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？?！!。、]/g, "");
        // Remove extra spaces
        normalized = normalized.replace(/\s{2,}/g, " ").trim().toLowerCase();
        
        // If Japanese, remove English words for scoring if requested
        if (originalLang === 'ja') {
            normalized = normalized.replace(/[a-zA-Z]+/g, "").trim();
        }
        
        return normalized;
    };

    const getComparison = () => {
        if (!activeLine) return null;
        const target = normalizeText(activeLine.text);
        const current = normalizeText(input);
        
        const isMatch = target === current;
        const score = isMatch ? 100 : 0; // Simple match for now

        return { isMatch, score };
    };

    const result = isSubmitted ? getComparison() : null;

    const handleNext = () => {
        const nextIdx = activeLineIndex + 1;
        if (nextIdx < subtitles.length) {
            setPlaying(false);
            requestSeek(subtitles[nextIdx].start, nextIdx);
        }
    };

    const handlePrev = () => {
        const prevIdx = activeLineIndex - 1;
        if (prevIdx >= 0) {
            setPlaying(false);
            requestSeek(subtitles[prevIdx].start, prevIdx);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header / Info */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50">Dictation Mode</span>
                    <div className="flex items-center gap-2">
                         <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-slate-500">
                            {originalLang === 'ja' ? 'JP (No English Score)' : originalLang?.toUpperCase()}
                         </span>
                    </div>
                 </div>
                 <h3 className="text-sm font-bold text-slate-400">Nghe và gõ lại nội dung bạn nghe được. Hệ thống sẽ tự bỏ qua dấu câu khi chấm điểm.</h3>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col gap-6">
                {/* Visualizer / Audio Control */}
                <div className="flex items-center justify-center p-8 bg-slate-900/30 rounded-3xl border border-dashed border-white/10 group">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                             {isPlaying && (
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="absolute inset-[-20px] bg-emerald-500 rounded-full blur-xl"
                                />
                             )}
                             <button 
                                onClick={handleReplay}
                                className="relative z-10 w-20 h-20 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all"
                             >
                                <Headphones size={32} />
                             </button>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Click to Replay</span>
                    </div>
                </div>

                {/* Input Area */}
                <div className="space-y-4">
                    <div className="relative">
                        <textarea 
                            autoFocus
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type what you hear..."
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl p-6 text-lg font-medium text-white focus:outline-none focus:border-emerald-500/50 min-h-[120px] transition-all"
                        />
                        <div className="absolute bottom-4 right-4 flex gap-2">
                             <button 
                                onClick={() => setIsRevealed(!isRevealed)}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                                title={isRevealed ? "Hide Answer" : "Reveal Answer"}
                             >
                                {isRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
                             </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {isRevealed && activeLine && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                            >
                                <p className="text-[10px] uppercase font-black text-emerald-500 mb-1">Answer</p>
                                <p className="text-white font-medium">
                                    {activeLine.text.replace(/\s*\[[^\]]*\]\s*/g, '').replace(/\s*[|/]\s*/g, '').trim()}
                                </p>
                                <p className="text-slate-400 text-sm italic mt-1">{activeLine.trans}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isSubmitted && result && (
                         <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`p-6 rounded-2xl border flex items-center gap-4 ${result.isMatch ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}
                         >
                            <div className={`p-3 rounded-full ${result.isMatch ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                                {result.isMatch ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                            </div>
                            <div>
                                <h4 className={`font-black uppercase tracking-widest text-xs ${result.isMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {result.isMatch ? 'Hoàn hảo!' : 'Chưa chính xác'}
                                </h4>
                                <p className="text-slate-300 text-sm font-medium">
                                    {result.isMatch ? 'Bạn đã nghe chính xác 100% nội dung.' : 'Hãy nghe lại và thử lại một lần nữa.'}
                                </p>
                            </div>
                         </motion.div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col gap-4 pb-6">
                <div className="flex gap-4">
                     <button 
                        onClick={handlePrev}
                        disabled={activeLineIndex <= 0}
                        className="p-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl transition-all disabled:opacity-20"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <button 
                        onClick={() => setIsSubmitted(true)}
                        className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Send size={16} /> Check Answer
                    </button>

                    <button 
                        onClick={handleNext}
                        disabled={activeLineIndex >= subtitles.length - 1}
                        className="p-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl transition-all disabled:opacity-20"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};
