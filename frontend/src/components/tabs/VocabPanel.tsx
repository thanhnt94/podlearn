import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Loader2, Sparkles, Activity, Globe, Languages, RefreshCw, CheckCircle2 } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface AnalyzedVocab {
    original: string;
    lemma: string;
    reading: string;
    pos: string;
    meanings: string[];
    source?: string;
}

interface SavedVocab {
    item_id: number;
    term: string;
    definition: string;
    reading: string;
    source: string;
}

export const VocabPanel: React.FC = () => {
    const { lessonId, s1Lines, activeLineIndex } = usePlayerStore();
    
    // States
    const [savedVocab, setSavedVocab] = useState<SavedVocab[]>([]);
    const [syncedSource, setSyncedSource] = useState<string>('unknown');
    const [dynamicVocab, setDynamicVocab] = useState<AnalyzedVocab[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [dictPriority, setDictPriority] = useState<'mazii' | 'jamdict'>('mazii');
    const currentTextRef = React.useRef<string>('');
    const [activeSubTab, setActiveSubTab] = useState<'live' | 'all'>('live');

    // Sync with Subtitles
    useEffect(() => {
        const line = s1Lines[activeLineIndex];
        if (line && line.text) {
            analyzeSentence(line.text, dictPriority);
        } else if (!line) {
            setDynamicVocab([]);
            currentTextRef.current = '';
        }
    }, [activeLineIndex, s1Lines, dictPriority]);

    useEffect(() => {
        fetchSavedVocab();
    }, [lessonId]);

    const analyzeSentence = async (text: string, priority: string) => {
        currentTextRef.current = text;
        setIsAnalyzing(true);

        try {
            const response = await axios.post('/api/vocab/analyze', { text, priority });
            if (text !== currentTextRef.current) return;
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
            const res = await axios.post('/api/vocab/generate-all', { 
                lesson_id: Number(lessonId),
                priority: dictPriority 
            });
            setSyncedSource(res.data.source);
            await fetchSavedVocab();
        } catch (err) {
            console.error("Sync failed", err);
        } finally {
            setIsGenerating(false);
        }
    };

    const fetchSavedVocab = async () => {
        if (!lessonId) return;
        try {
            const response = await axios.get(`/api/vocab/list/${lessonId}`);
            // Backend now returns { vocab: [], source: string }
            setSavedVocab(response.data.vocab || []);
            setSyncedSource(response.data.source || 'unknown');
        } catch (err) {
            console.error("Failed to fetch saved vocab");
        }
    };

    const handleSaveToVocab = async (item: AnalyzedVocab) => {
        try {
            await axios.post(`/api/vocab/add`, {
                lesson_id: lessonId,
                term: item.lemma,
                definition: Array.isArray(item.meanings) ? item.meanings.join(', ') : item.meanings,
                example: item.original
            });
            fetchSavedVocab();
        } catch (err) {
            console.error("Save failed");
        }
    };

    const filteredSaved = savedVocab.filter(v => 
        v.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
        v.definition.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isOutOfSync = syncedSource !== 'unknown' && syncedSource !== dictPriority;

    return (
        <div className="flex flex-col h-full gap-4 pb-20 overflow-y-auto custom-scrollbar relative">
            
            {/* Header / Tab Switcher */}
            <div className="space-y-2 sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md pt-1">
                <div className="flex p-1 bg-slate-900/80 rounded-xl border border-white/5">
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

                {/* Dictionary Priority Toggle */}
                <div className="flex items-center justify-between px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase">
                        <Globe size={10} /> Priority
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => setDictPriority('mazii')}
                            className={`px-2 py-1 rounded text-[9px] font-black transition-all ${dictPriority === 'mazii' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                            MAZII (VN)
                        </button>
                        <button 
                            onClick={() => setDictPriority('jamdict')}
                            className={`px-2 py-1 rounded text-[9px] font-black transition-all ${dictPriority === 'jamdict' ? 'bg-slate-800 text-slate-400 border border-white/5' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                            JMDICT (EN)
                        </button>
                    </div>
                </div>
            </div>

            {isGenerating && (
                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-sky-500/20">
                    <div className="relative mb-6">
                        <Loader2 size={48} className="text-sky-500 animate-spin" />
                        <Sparkles size={24} className="text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Syncing Offline Glossary</h3>
                    <p className="text-sm text-slate-400">Respecting API limits. Your data is being stored locally.</p>
                </div>
            )}

            {activeSubTab === 'live' ? (
                <section className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Languages size={16} className="text-sky-400" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contextual Insight</h3>
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
                                    className="rounded-2xl p-4 bg-sky-500/5 border border-sky-500/10 hover:bg-sky-500/10 transition-all group relative overflow-hidden"
                                >
                                    <div className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase rounded-bl-lg ${item.source === 'mazii' ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                                        {item.source === 'mazii' ? 'MZ' : 'JAM'}
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-lg font-bold text-white leading-none">{item.lemma}</h4>
                                                <span className="text-xs text-slate-500 font-mono">[{item.reading}]</span>
                                            </div>
                                            <p className="text-sm text-slate-300 pr-8">
                                                {Array.isArray(item.meanings) ? item.meanings.join(', ') : item.meanings}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => handleSaveToVocab(item)}
                                            className="p-2 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 rounded-lg text-slate-400 transition-all shadow-lg"
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
                    
                    {/* Smart Sync Alert */}
                    <div className={`rounded-2xl p-4 border transition-all flex items-center justify-between gap-4 ${isOutOfSync ? 'bg-orange-500/10 border-orange-500/30 shadow-lg shadow-orange-500/5' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                {isOutOfSync ? <RefreshCw size={14} className="text-orange-400 animate-spin-slow" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                                <span className={`text-[10px] font-black uppercase ${isOutOfSync ? 'text-orange-400' : 'text-emerald-400'}`}>
                                    {isOutOfSync ? 'Source Mismatch' : 'Up to date'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {isOutOfSync 
                                    ? `Current data is from ${syncedSource.toUpperCase()}. Sync for ${dictPriority.toUpperCase()}?` 
                                    : `Offline data matches your ${dictPriority.toUpperCase()} preference.`}
                            </p>
                        </div>
                        <button 
                            onClick={handleGenerateAll} 
                            disabled={isGenerating}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg ${isOutOfSync ? 'bg-orange-500 text-slate-950 shadow-orange-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                            {isGenerating ? 'Syncing...' : (isOutOfSync ? `Sync ${dictPriority.toUpperCase()}` : 'Re-sync')}
                        </button>
                    </div>

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
                            <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors relative">
                                <div className="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase text-slate-600 group-hover:text-slate-400">
                                    {v.source}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-white font-bold">{v.term}</h4>
                                        <span className="text-[10px] text-slate-500">[{v.reading}]</span>
                                    </div>
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
