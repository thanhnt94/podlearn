import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Loader2, Sparkles, Activity } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AnalyzedVocab {
    original: string;
    lemma: string;
    reading: string;
    pos: string;
    meanings: string[];
}

interface SavedVocab {
    id: number;
    term: string;
    definition: string;
    example?: string;
}

export const VocabPanel: React.FC = () => {
    const { lessonId, s1Lines, activeLineIndex } = usePlayerStore();
    
    // States
    const [savedVocab, setSavedVocab] = useState<SavedVocab[]>([]);
    const [dynamicVocab, setDynamicVocab] = useState<AnalyzedVocab[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const currentTextRef = React.useRef<string>('');
    const [activeSubTab, setActiveSubTab] = useState<'live' | 'all'>('live');

    // Sync with Subtitles
    useEffect(() => {
        const line = s1Lines[activeLineIndex];
        if (line && line.text && line.text !== currentTextRef.current) {
            analyzeSentence(line.text);
        } else if (!line && currentTextRef.current !== '') {
            setDynamicVocab([]);
            currentTextRef.current = '';
        }
    }, [activeLineIndex, s1Lines]);

    useEffect(() => {
        fetchSavedVocab();
    }, [lessonId]);

    const hasData = (savedVocab.length > 0);
    const showGenerateButton = !hasData && !isGenerating;

    const analyzeSentence = async (text: string) => {
        currentTextRef.current = text;
        setIsAnalyzing(true);

        try {
            const response = await axios.post('/api/vocab/analyze', { text });
            if (text !== currentTextRef.current) {
                setIsAnalyzing(false);
                return;
            }
            setDynamicVocab(response.data);
        } catch (err) {
            console.error("Analysis failed", err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateAll = async () => {
        if (!lessonId) return;
        setIsGenerating(true);
        try {
            await axios.post('/api/vocab/generate-all', { lesson_id: Number(lessonId) });
            await fetchSavedVocab();
        } catch (err) {
            console.error("Generation failed", err);
        } finally {
            setIsGenerating(false);
        }
    };

    const fetchSavedVocab = async () => {
        if (!lessonId) return;
        try {
            const response = await axios.get(`/api/vocab/list/${lessonId}`);
            setSavedVocab(response.data);
        } catch (err) {
            console.error("Failed to fetch saved vocab");
        }
    };

    const handleSaveToVocab = async (item: AnalyzedVocab) => {
        try {
            await axios.post(`/api/vocab/add`, {
                lesson_id: lessonId,
                term: item.lemma,
                definition: item.meanings.join(', '),
                example: item.original
            });
            fetchSavedVocab();
        } catch (err) {
            console.error("Save failed");
        }
    };

    const filteredSaved = Array.isArray(savedVocab) 
        ? savedVocab.filter(v => 
            v.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
            v.definition.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : [];

    return (
        <div className="flex flex-col h-full gap-4 pb-20 overflow-y-auto custom-scrollbar relative">
            
            <div className="flex p-1 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 sticky top-0 z-20">
                <button 
                    onClick={() => setActiveSubTab('live')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'live' ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Activity size={14} /> Live
                </button>
                <button 
                    onClick={() => setActiveSubTab('all')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'all' ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Book size={14} /> All Vocab
                </button>
            </div>

            {isGenerating && (
                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center rounded-3xl">
                    <Loader2 size={48} className="text-sky-500 animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Analyzing Transcript...</h3>
                </div>
            )}

            {activeSubTab === 'live' ? (
                <section className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-yellow-400" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Sentence Insight</h3>
                        </div>
                        {isAnalyzing && (
                            <div className="flex items-center gap-2 text-[10px] text-sky-400">
                                <Loader2 size={12} className="animate-spin" /> ANALYZING...
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3">
                        <AnimatePresence mode="popLayout">
                            {Array.isArray(dynamicVocab) && dynamicVocab.length > 0 ? (
                            dynamicVocab.map((item, idx) => (
                                <motion.div 
                                    key={item.lemma + idx}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="rounded-2xl p-4 bg-sky-500/5 border border-sky-500/10 hover:bg-sky-500/10 transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-lg font-bold text-white">{item.lemma}</h4>
                                                <span className="text-xs text-slate-500 font-mono">[{item.reading}]</span>
                                            </div>
                                            <p className="text-sm text-slate-300">
                                                {Array.isArray(item.meanings) ? item.meanings.join(', ') : item.meanings}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => handleSaveToVocab(item)}
                                            className="p-2 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 rounded-lg text-slate-400 transition-all"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                            ) : !isAnalyzing && (
                                <div className="text-[10px] text-slate-600 italic px-2">Ready to analyze Japanese...</div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            ) : (
                <section className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    {showGenerateButton && (
                        <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-sky-400 uppercase">Deep Analysis</span>
                                <p className="text-xs text-slate-400">Generate all vocab for this video.</p>
                            </div>
                            <button onClick={handleGenerateAll} className="px-4 py-2 bg-sky-500 text-slate-950 rounded-xl font-bold text-xs">
                                Generate
                            </button>
                        </div>
                    )}

                    <div className="flex-1 flex items-center px-4 gap-3 bg-slate-950/50 rounded-xl border border-white/5">
                        <Search size={18} className="text-slate-500" />
                        <input 
                            type="text"
                            placeholder="Search glossary..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent py-3 text-sm focus:outline-none"
                        />
                    </div>

                    <div className="space-y-3">
                        {filteredSaved.map((v, idx) => (
                            <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex justify-between items-start">
                                <div className="space-y-1">
                                    <h4 className="text-white font-bold">{v.term}</h4>
                                    <p className="text-sm text-slate-400">{v.definition}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};
