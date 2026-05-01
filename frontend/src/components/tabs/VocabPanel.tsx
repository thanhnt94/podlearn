import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Check, Activity, Globe, Languages, 
    RotateCcw, Book, ChevronDown,
    BarChart3, AlertCircle, Clock
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';


export const VocabPanel: React.FC = () => {
    const { 
        lessonId, activeLineIndex, subtitles,
        appendNote, fetchNotes,
        sourceTrackId, setSourceTrackId, analysisSource,
        availableTracks, fetchVideoGlossary,
        analyzedWords, fetchAnalyzedWords,
        showFurigana, toggleFurigana,
        autoSegmentationEnabled, setAutoSegmentationEnabled,
        useOfflineDict,
        targetLang, setTargetLang,
        preferredSystemDictId, setPreferredSystemDictId,
        globalDictionaries,
        setAnalysisSource
    } = usePlayerStore();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'track' | 'live' | 'stats'>('track');
    const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const { 
        setShowDictManager,
        fetchSystemDictionaries
    } = usePlayerStore();

    useEffect(() => {
        fetchVideoGlossary();
        fetchSystemDictionaries();
    }, [lessonId]);


    const handleApplySettings = async () => {
        setIsSaving(true);
        try {
            // Save settings to database
            await axios.patch(`/api/study/lesson/${lessonId}/settings`, {
                sourceTrackId,
                autoSegmentationEnabled,
                useOfflineDict,
                analysisSource
            });

            // Trigger analysis for current line if active
            if (activeLineIndex !== -1) {
                const currentText = subtitles[activeLineIndex]?.text || '';
                const selectedTrack = availableTracks.find(t => t.id === sourceTrackId);
                const srcLang = selectedTrack?.language_code || 'ja';
                await fetchAnalyzedWords(currentText, srcLang);
            }
            // Switch to Live Tab after saving
            setActiveTab('live');
        } catch (err) {
            console.error("Failed to save settings:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveToVocab = async (item: any) => {
        try {
            const exampleText = (item.original || subtitles[activeLineIndex]?.text || '')
                .replace(/[|/]/g, '')
                .replace(/\s*\[[^\]]*\]/g, '');
                
            const term = item.lemma || item.surface || item.term || item.word;
            
            const response = await axios.post(`/api/study/vocab/add`, {
                lesson_id: lessonId,
                term: term,
                reading: item.reading,
                definition: Array.isArray(item.meanings) ? item.meanings.join(', ') : (item.meanings || item.definition || item.meaning),
                example: exampleText,
                timestamp: item.timestamp || 0
            });
            
            if (response.data.note_id) {
                const newNote = {
                    id: response.data.note_id,
                    timestamp: item.timestamp || 0,
                    content: `**${term}**${item.reading ? ` [${item.reading}]` : ''}\n${Array.isArray(item.meanings) ? item.meanings.join(', ') : (item.meanings || item.definition || item.meaning)}\n\n*${exampleText}*`,
                    created_at: new Date().toISOString()
                };
                appendNote(newNote);
                setJustAdded(prev => new Set(prev).add(term));
            }
            fetchNotes();
        } catch (err) {}
    };

    // Statistics Calculation - aggregate from all subtitles
    const vocabStats = useMemo(() => {
        const counts: Record<string, { term: string, reading: string, count: number }> = {};
        
        const delimiters = ['|', '/', ' '];
        
        subtitles.forEach(line => {
            // Find active delimiter like backend does
            const activeDelimiter = delimiters.find(d => line.text.includes(d));
            
            let words: string[] = [];
            if (activeDelimiter) {
                words = line.text.split(activeDelimiter).map(w => w.trim()).filter(w => w.length > 0);
            } else {
                words = [line.text.trim()].filter(w => w.length > 0);
            }

            words.forEach(w => {
                const term = w;
                if (!counts[term]) {
                    counts[term] = { term, reading: '', count: 1 };
                } else {
                    counts[term].count++;
                }
            });
        });

        // Merge with reading/meaning info from analyzedWords if currently present
        analyzedWords.forEach(aw => {
            if (counts[aw.surface]) {
                counts[aw.surface].reading = aw.reading || '';
            }
        });

        return Object.values(counts)
            .filter(v => v.term.length > 1 || /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(v.term)) // Filter noise but keep CJK
            .sort((a, b) => b.count - a.count)
            .slice(0, 100);
    }, [subtitles, analyzedWords]);

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Header / Tabs */}
            <div className="p-4 border-b border-white/5 bg-slate-900/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center">
                            <Book size={12} className="text-sky-500" />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Word Manager</h3>
                    </div>
                    <button 
                        onClick={() => setShowDictManager(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[9px] font-black uppercase tracking-widest text-sky-500 hover:bg-sky-500 hover:text-slate-950 transition-all shadow-lg shadow-sky-500/5"
                    >
                        <Languages size={12} />
                        DictManager
                    </button>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {[
                        { id: 'track', label: 'Settings', icon: Activity },
                        { id: 'live', label: 'Analysis', icon: Globe },
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
                    {activeTab === 'track' && (
                        <motion.div 
                            key="track"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-6 space-y-8 h-full overflow-y-auto no-scrollbar"
                        >
                            {/* Subtitle Track Selection */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    <Globe size={12} className="text-sky-500" />
                                    Subtitle Track
                                </label>
                                <div className="relative group">
                                    <select 
                                        value={sourceTrackId || ''}
                                        onChange={(e) => setSourceTrackId(Number(e.target.value))}
                                        className="w-full bg-slate-900/60 border border-white/10 rounded-2xl px-6 py-4 text-[11px] font-black uppercase tracking-wider text-white appearance-none cursor-pointer outline-none focus:border-sky-500/50 transition-all shadow-inner"
                                    >
                                        <option value="" disabled>Select a track...</option>
                                        {availableTracks.map((track: any) => (
                                            <option key={track.id} value={track.id}>
                                                [{ (track.language_code || '??').toUpperCase() }] {track.name || 'Untitled Track'}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-sky-500 transition-colors">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            {/* Segmentation Toggle */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    <Activity size={12} className="text-amber-500" />
                                    Analysis Mode
                                </label>
                                <div className="p-6 rounded-[32px] bg-slate-900/40 border border-white/5 flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                            {autoSegmentationEnabled ? 'Automatic Splitting' : 'Original Subtitle'}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-medium leading-tight max-w-[180px]">
                                            {autoSegmentationEnabled 
                                                ? 'AI analyzes and splits sentences into words automatically.' 
                                                : 'Strictly follow the time-aligned lines from the subtitle file.'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newVal = !autoSegmentationEnabled;
                                            setAutoSegmentationEnabled(newVal);
                                            // Also update analysis source to match
                                            setAnalysisSource(newVal ? 'auto' : 'track', sourceTrackId);
                                        }}
                                        className={`w-12 h-6 rounded-full relative transition-all flex-shrink-0 ${autoSegmentationEnabled ? 'bg-sky-500' : 'bg-slate-800'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${autoSegmentationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Dictionary Language */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    <Languages size={12} className="text-emerald-500" />
                                    Dictionary Target
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['vi', 'en', 'cn'].map(lang => (
                                        <button
                                            key={lang}
                                            onClick={() => setTargetLang(lang as any)}
                                            className={`px-3 py-3 rounded-2xl border text-[10px] font-black uppercase transition-all ${
                                                targetLang === lang 
                                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                                                : 'bg-white/5 border-white/5 text-slate-500'
                                            }`}
                                        >
                                            {lang.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dictionary Selection (Dynamic based on pair) */}
                            {sourceTrackId && (
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        <Book size={12} className="text-rose-500" />
                                        Dictionary Selection
                                    </label>
                                    <div className="relative group">
                                        <select 
                                            value={preferredSystemDictId || ''}
                                            onChange={(e) => setPreferredSystemDictId(e.target.value)}
                                            className="w-full bg-slate-900/60 border border-white/10 rounded-2xl px-6 py-4 text-[11px] font-black uppercase tracking-wider text-white appearance-none cursor-pointer outline-none focus:border-rose-500/50 transition-all shadow-inner"
                                        >
                                            <option value="">Default (System Auto)</option>
                                            {globalDictionaries
                                                .filter(d => {
                                                    const selectedTrack = availableTracks.find(t => t.id === sourceTrackId);
                                                    const srcLang = selectedTrack?.language_code || 'ja';
                                                    return d.src === srcLang && d.target === targetLang;
                                                })
                                                .map(dict => (
                                                    <option key={dict.id} value={dict.id}>
                                                        {dict.name} ({dict.count} terms)
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-rose-500 transition-colors">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-slate-600 font-bold px-2 italic uppercase">
                                        Showing dictionaries for {availableTracks.find(t => t.id === sourceTrackId)?.language_name || '...'} → {targetLang.toUpperCase()}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleApplySettings}
                                disabled={isSaving}
                                className="w-full py-5 rounded-[32px] bg-sky-500 text-slate-950 text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-sky-500/20 active:scale-95 transition-all"
                            >
                                {isSaving ? 'Applying...' : 'Apply & Refresh'}
                            </button>
                        </motion.div>
                    )}

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
                                    <Activity size={14} className="text-sky-500" />
                                    Current Vocabulary
                                </h3>
                                <div className="flex items-center gap-4">
                                    <button onClick={toggleFurigana} className={`p-2 rounded-lg transition-all ${showFurigana ? 'text-sky-500' : 'text-slate-600'}`}>
                                        <Languages size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const selectedTrack = availableTracks.find(t => t.id === sourceTrackId);
                                            const srcLang = selectedTrack?.language_code || 'ja';
                                            fetchAnalyzedWords(subtitles[activeLineIndex]?.text || '', srcLang);
                                        }}
                                        className="text-slate-600 hover:text-white"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                {analyzedWords.map((item: any, idx: number) => {
                                    const isSaved = justAdded.has(item.surface || item.lemma || item.term);
                                    const isSkip = item.lemma === 'skip' || item.lemma_override === 'skip';
                                    
                                    return (
                                        <motion.div 
                                            key={idx}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`bg-slate-900/60 border border-white/5 rounded-[32px] p-6 hover:border-sky-500/40 transition-all group relative overflow-hidden ${isSkip ? 'opacity-30 grayscale scale-[0.98]' : ''}`}
                                        >
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="space-y-3 flex-1 pr-6">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-2xl font-black text-white tracking-tight leading-none">{item.surface || item.lemma}</span>
                                                        {item.reading && !isSkip && (
                                                            <span className="text-[11px] text-sky-400 font-black tracking-widest uppercase bg-sky-400/10 px-3 py-1 rounded-full border border-sky-400/20">
                                                                {item.reading}
                                                            </span>
                                                        )}
                                                        {isSkip && <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">[Skipped]</span>}
                                                    </div>
                                                    {!isSkip && (
                                                        <div className="prose prose-invert max-w-none text-slate-400 text-sm leading-relaxed font-medium">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                                                {Array.isArray(item.meanings) ? item.meanings.join(', ') : (item.meanings || item.definition || '')}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>
                                                {!isSkip && (
                                                    <button 
                                                        onClick={() => handleSaveToVocab(item)} 
                                                        className={`p-4 rounded-2xl transition-all duration-300 shadow-xl active:scale-90 ${isSaved ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-sky-500 hover:text-white'}`}
                                                    >
                                                        {isSaved ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                                                    </button>
                                                )}
                                            </div>
                                            {!isSkip && <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
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
                            className="p-6 space-y-6"
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
                </AnimatePresence>
            </div>
        </div>
    );
};
