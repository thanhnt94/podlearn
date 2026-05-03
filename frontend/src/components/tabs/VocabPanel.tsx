import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Check, Globe, RotateCcw,
    BarChart3, AlertCircle, Clock, Languages,
    Layers
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FlashcardTab } from './FlashcardTab';

export const VocabPanel: React.FC = () => {
    const { 
        lessonId, activeLineIndex, subtitles,
        fetchNotes,
        analyzedWords, fetchAnalyzedWords,
        showFurigana, toggleFurigana,
        fetchSystemDictionaries,
        fetchVideoGlossary
    } = usePlayerStore();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'live' | 'stats' | 'mastery'>('live');
    const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchVideoGlossary();
        fetchSystemDictionaries();
    }, [lessonId]);

    const handleSaveToVocab = async (item: any) => {
        try {
            const exampleText = (item.original || subtitles[activeLineIndex]?.text || '')
                .replace(/\|/g, '')
                .replace(/\s*\[[^\]]*\]/g, '');
                
            const term = item.lemma || item.surface || item.term || item.word;
            
            await axios.post(`/api/study/vocab/add`, {
                lesson_id: lessonId,
                word: term,
                reading: item.reading,
                meaning: Array.isArray(item.meanings) ? item.meanings.join(', ') : (item.meanings || item.definition || item.meaning),
                example: exampleText
            });
            
            setJustAdded(prev => new Set(prev).add(term));
            usePlayerStore.getState().fetchVocab();
            fetchNotes();
        } catch (err) {}
    };

    // Statistics Calculation - aggregate from all subtitles
    const vocabStats = useMemo(() => {
        const counts: Record<string, { term: string, reading: string, count: number }> = {};
        const delimiters = ['|', ' '];
        
        subtitles.forEach(line => {
            const activeDelimiter = delimiters.find(d => line.text.includes(d));
            let words: string[] = [];
            if (activeDelimiter) {
                words = line.text.split(activeDelimiter).map(w => w.trim()).filter(w => w.length > 0);
            } else {
                words = [line.text.trim()].filter(w => w.length > 0);
            }

            words.forEach(w => {
                // Ignore tokens that are just brackets/tags or explicitly marked as skip
                if (w.includes('[-]') || w.includes('[s]') || w.includes('[skip]') || /^[、。！？（）「」『』…ー\s\d]+$/.test(w)) return;
                
                const term = w.replace(/\{[^\}]+\}/g, '').replace(/\[[^\]]*\]/g, '').trim();
                if (!term || term.length < 1) return;

                if (!counts[term]) {
                    counts[term] = { term, reading: '', count: 1 };
                } else {
                    counts[term].count++;
                }
            });
        });

        return Object.values(counts)
            .filter(v => v.term.length > 0 && /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(v.term))
            .sort((a, b) => b.count - a.count)
            .slice(0, 100);
    }, [subtitles, analyzedWords]);

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Header / Tabs */}
            <div className="p-4 border-b border-white/5 bg-slate-900/40">
                
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {[
                        { id: 'live', label: 'Analysis', icon: Globe },
                        { id: 'mastery', label: 'Mastery', icon: Layers },
                        { id: 'stats', label: 'Stats', icon: BarChart3 },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                activeTab === tab.id 
                                ? 'bg-white/10 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'live' && (
                        <motion.div 
                            key="live"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-6 space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 flex items-center gap-2">
                                    <Globe size={14} className="text-sky-500" />
                                    Current Vocabulary
                                </h3>
                                <div className="flex items-center gap-4">
                                    <button onClick={toggleFurigana} className={`p-2 rounded-lg transition-all ${showFurigana ? 'text-sky-500' : 'text-slate-600'}`}>
                                        <Languages size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const { sourceTrackId, availableTracks, originalLang } = usePlayerStore.getState();
                                            const selectedTrack = availableTracks.find(t => t.id === sourceTrackId);
                                            const srcLang = selectedTrack?.language_code || originalLang || 'ja';
                                            fetchAnalyzedWords(subtitles[activeLineIndex]?.text || '', srcLang);
                                        }}
                                        className="text-slate-600 hover:text-white"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-4 h-full overflow-y-auto no-scrollbar pb-20">
                                {analyzedWords.filter((item: any) => {
                                    return !(['-', 's', 'skip'].includes(item.lemma) || ['-', 's', 'skip'].includes(item.lemma_override));
                                }).map((item: any, idx: number) => {
                                    const isSaved = justAdded.has(item.surface || item.lemma || item.term);
                                    const displaySurface = (item.surface || item.lemma || '').replace(/\{[^\}]+\}/g, '').replace(/\[[^\]]*\]/g, '');
                                    
                                    return (
                                        <motion.div 
                                            key={idx}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`bg-slate-900/60 border border-white/5 rounded-[32px] p-6 hover:border-sky-500/40 transition-all group relative overflow-hidden`}
                                        >
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="space-y-3 flex-1 pr-6">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-2xl font-black text-white tracking-tight leading-none">{displaySurface}</span>
                                                        {item.reading && (
                                                            <span className="text-[11px] text-sky-400 font-black tracking-widest uppercase bg-sky-400/10 px-3 py-1 rounded-full border border-sky-400/20">
                                                                {item.reading}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="prose prose-invert max-w-none text-slate-400 text-sm leading-relaxed font-medium">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                                            {Array.isArray(item.meanings) ? item.meanings.join(', ') : (item.meanings || item.definition || '')}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleSaveToVocab(item)} 
                                                    className={`p-4 rounded-2xl transition-all duration-300 shadow-xl active:scale-90 ${isSaved ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-sky-500 hover:text-white'}`}
                                                >
                                                    {isSaved ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                                                </button>
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </motion.div>
                                    );
                                })}

                                {analyzedWords.length === 0 && (
                                    <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-slate-900/20">
                                        <AlertCircle size={40} className="mx-auto text-slate-800 mb-6 opacity-20" />
                                        <p className="text-[12px] font-black text-slate-700 uppercase tracking-[0.3em]">Ready for analysis</p>
                                        <p className="text-[10px] text-slate-800 mt-3 font-medium">Head to Settings to configure your study source</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'stats' && (
                        <motion.div 
                            key="stats"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-6 space-y-6 h-full overflow-y-auto no-scrollbar pb-20"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 flex items-center gap-2">
                                    <BarChart3 size={14} className="text-amber-500" />
                                    Lesson Statistics
                                </h3>
                                <span className="text-[9px] font-bold text-slate-700 uppercase">{vocabStats.length} Unique Terms</span>
                            </div>

                            <div className="space-y-3">
                                {vocabStats.map((item, idx) => (
                                    <div key={idx} className="bg-slate-900/40 border border-white/5 rounded-[28px] p-5 flex items-center justify-between group hover:bg-slate-900/60 transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-xs font-black text-slate-500 group-hover:text-amber-500 transition-colors">
                                                #{idx + 1}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-base font-black text-white">{item.term}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.reading}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                                                <Clock size={10} className="text-amber-500" />
                                                <span className="text-[10px] font-black text-amber-500">{item.count}</span>
                                            </div>
                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-tighter">Occurrences</span>
                                        </div>
                                    </div>
                                ))}

                                {vocabStats.length === 0 && (
                                    <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-slate-900/20">
                                        <BarChart3 size={40} className="mx-auto text-slate-800 mb-6 opacity-20" />
                                        <p className="text-[12px] font-black text-slate-700 uppercase tracking-[0.3em]">No Stats Yet</p>
                                        <p className="text-[10px] text-slate-800 mt-3 font-medium">Save some vocabulary to see frequency data</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'mastery' && (
                        <motion.div 
                            key="mastery"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="h-full"
                        >
                            <FlashcardTab />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
