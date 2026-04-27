import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Type, ExternalLink, Plus, Scissors, RotateCcw, Check, X, Zap, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';import axios from 'axios';

export const LearningFocusBar: React.FC = () => {
    const { 
        analyzedWords, 
        showFurigana, 
        toggleFurigana,
        subtitles,
        activeLineIndex,
        lessonId,
        addNote,
        hasTokens,
        checkScanStatus,
        fetchAnalyzedWords,
        isManualAnalysis
    } = usePlayerStore();

    const [isEditing, setIsEditing] = React.useState(false);
    const [editTokens, setEditTokens] = React.useState<any[]>([]);
    const [isScanningGlobal, setIsScanningGlobal] = React.useState(false);

    // Tooltip State
    const [hoveredToken, setHoveredToken] = React.useState<{word: any, rect: DOMRect} | null>(null);
    const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTokenMouseEnter = (e: React.MouseEvent, word: any) => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredToken({ word, rect });
    };

    const handleTokenMouseLeave = () => {
        tooltipTimer.current = setTimeout(() => {
            setHoveredToken(null);
        }, 150);
    };

    const handleTooltipMouseEnter = () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };

    const handleTooltipMouseLeave = () => {
        tooltipTimer.current = setTimeout(() => {
            setHoveredToken(null);
        }, 150);
    };

    const handleStartScan = async () => {
        setIsScanningGlobal(true);
        try {
            await usePlayerStore.getState().scanFullLesson('mazii_offline');
            // After scan, the overlay will disappear automatically
        } catch (e) {
            console.error(e);
        } finally {
            setIsScanningGlobal(false);
        }
    };

    React.useEffect(() => {
        if (lessonId) checkScanStatus();
    }, [lessonId]);

    const handleAddToVocab = async (word: any) => {
        if (!lessonId) return;
        const currentLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;
        const timestamp = currentLine ? currentLine.start : 0;

        try {
            const response = await axios.post(`/api/vocab/add`, {
                lesson_id: lessonId,
                term: word.lemma || word.surface,
                reading: word.reading,
                definition: Array.isArray(word.meanings) ? word.meanings.join(', ') : word.meanings,
                example: currentLine ? currentLine.text : '',
                timestamp: timestamp
            });
            
            if (response.data.note_id) {
                const newNote = {
                    id: response.data.note_id,
                    timestamp: timestamp,
                    content: `**${word.lemma || word.surface}**${word.reading ? ` [${word.reading}]` : ''}\n${Array.isArray(word.meanings) ? word.meanings.join(', ') : word.meanings}`,
                    created_at: new Date().toISOString()
                };
                addNote(newNote);
                // Use a custom Toast or simple feedback instead of alert for better UX
            }
        } catch (err) {
            console.error("Save failed", err);
        }
    };

    const startEditing = () => {
        setEditTokens(analyzedWords.map((w: any) => ({
            surface: w.surface,
            lemma_override: w.lemma_override || (w.lemma && w.lemma !== w.surface ? w.lemma : null)
        })));
        setIsEditing(true);
    };

    const saveEditing = async () => {
        if (!lessonId || activeLineIndex === -1) return;
        try {
            await axios.post('/api/vocab/tokens/save', {
                lesson_id: lessonId,
                line_index: activeLineIndex,
                tokens: editTokens
            });
            await fetchAnalyzedWords(currentLine?.text || '', 'ja');
            await checkScanStatus();
            setIsEditing(false);
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    const resetEditing = async () => {
        if (!lessonId || activeLineIndex === -1) return;
        if (!confirm("Reset segmentation for this line?")) return;
        try {
            await axios.delete('/api/vocab/tokens/clear', {
                data: { lesson_id: lessonId, line_index: activeLineIndex }
            });
            await fetchAnalyzedWords(currentLine?.text || '', 'ja');
            setIsEditing(false);
        } catch (e) { console.error(e); }
    };

    const currentLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;

    if (!currentLine) return (
        <div className="w-full bg-slate-950/80 border-t border-white/5 backdrop-blur-xl px-8 py-4 h-[160px] flex items-center justify-center">
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Playback idle • Select a line to start analysis</p>
        </div>
    );

    return (
        <div className="w-full bg-slate-950/90 border-t border-white/5 backdrop-blur-3xl px-8 py-4 h-[160px] flex flex-col shadow-[0_-30px_60px_rgba(0,0,0,0.8)] relative transition-all duration-500">
            
            {/* NEEDS SCAN OVERLAY */}
            {!hasTokens && !isManualAnalysis && (
                <div className="absolute inset-0 z-[110] bg-slate-950/60 backdrop-blur-md flex items-center justify-center group/scan">
                    <div className="flex flex-col items-center gap-4 p-8 rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl transition-all group-hover/scan:scale-[1.02]">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                            <Zap size={24} fill="currentColor" />
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest">Full Scan Required</h3>
                            <p className="text-slate-400 text-[10px] font-medium">Scan entire lesson in Vocab tab to enable smart phrase analysis.</p>
                        </div>
                        <button 
                            onClick={handleStartScan}
                            disabled={isScanningGlobal}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${
                                isScanningGlobal 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:scale-105 active:scale-95 shadow-amber-500/20'
                            }`}
                        >
                            {isScanningGlobal ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    Scanning...
                                </div>
                            ) : "Start Scan Now"}
                        </button>
                    </div>
                </div>
            )}

            <div className="w-full h-full relative">
                {/* Controls - Floating above everything as requested */}
                <div className="absolute top-0 left-0 flex items-center gap-2 z-50 p-3">
                    <button 
                        onClick={toggleFurigana}
                        title="Toggle Furigana"
                        className={`p-2 rounded-lg transition-all duration-300 border ${
                            showFurigana 
                            ? 'bg-sky-500 border-sky-400 text-slate-950' 
                            : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                        }`}
                    >
                        <Type size={14} />
                    </button>

                    <button 
                        onClick={isEditing ? saveEditing : startEditing}
                        title={isEditing ? 'Save' : 'Edit Segments'}
                        className={`p-2 rounded-lg transition-all duration-300 border ${
                            isEditing 
                            ? 'bg-amber-500 border-amber-400 text-slate-950' 
                            : isManualAnalysis
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                        }`}
                    >
                        {isEditing ? <Check size={14} /> : <Scissors size={14} />}
                    </button>
                </div>

                {/* Center: Content with Proper Scrolling and Baseline Alignment */}
                <div className="w-full h-full overflow-y-auto custom-scrollbar p-6 pt-10">
                    <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-6 min-h-full">
                    {isEditing ? (
                        <div className="flex flex-wrap items-center justify-center gap-3 p-6 bg-amber-500/5 rounded-3xl border border-amber-500/20 w-full animate-in fade-in zoom-in-95">
                            {editTokens.map((token, i) => (
                                <div key={i} className="flex flex-col gap-1 px-3 py-2 bg-slate-900 border border-amber-500/30 rounded-xl group shadow-lg">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            value={token.surface} 
                                            onChange={(e) => {
                                                const newTokens = [...editTokens];
                                                newTokens[i] = { ...newTokens[i], surface: e.target.value };
                                                setEditTokens(newTokens);
                                            }}
                                            className="bg-transparent text-lg font-bold text-amber-200 outline-none w-20 text-center border-b border-transparent focus:border-amber-500/50"
                                        />
                                        <button 
                                            onClick={() => setEditTokens(editTokens.filter((_, idx) => idx !== i))}
                                            className="text-slate-600 hover:text-red-500 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={token.lemma_override || ''} 
                                        onChange={(e) => {
                                            const newTokens = [...editTokens];
                                            newTokens[i] = { ...newTokens[i], lemma_override: e.target.value || null };
                                            setEditTokens(newTokens);
                                        }}
                                        placeholder={`= ${token.surface}`}
                                        className="bg-amber-500/10 text-[10px] font-bold text-amber-400 outline-none w-full text-center rounded border border-amber-500/20 focus:border-amber-500/50 px-1 py-0.5"
                                        title="Dictionary Form (Lemma)"
                                    />
                                </div>
                            ))}
                            <button 
                                onClick={resetEditing}
                                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all"
                            >
                                <RotateCcw size={14} /> Reset
                            </button>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {analyzedWords.map((word: any, idx: number) => (
                                <motion.div 
                                    key={`${activeLineIndex}-${idx}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex flex-col items-center justify-end group relative min-h-[60px] ${word.pos === '助詞' ? 'cursor-default opacity-60' : 'cursor-help'}`}
                                    onMouseEnter={word.pos === '助詞' ? undefined : ((e) => handleTokenMouseEnter(e, word))}
                                    onMouseLeave={word.pos === '助詞' ? undefined : handleTokenMouseLeave}
                                >
                                    {showFurigana && word.furigana && (
                                        <span className="text-[10px] font-bold text-sky-400/80 mb-1 pointer-events-none select-none">
                                            {word.furigana}
                                        </span>
                                    )}
                                    <span 
                                        className={`text-lg md:text-2xl font-black tracking-tight transition-all duration-300 ${
                                            word.pos === '助詞' ? 'text-slate-600' : 'text-white group-hover:text-sky-400 group-hover:scale-110'
                                        }`}
                                    >
                                        {word.surface}
                                    </span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>

            {/* FIXED PREMIUM TOOLTIP VIA PORTAL */}
            {hoveredToken && createPortal(
                <div 
                    className="fixed z-[99999] origin-bottom animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                    style={{ 
                        left: hoveredToken.rect.left + hoveredToken.rect.width / 2, 
                        top: hoveredToken.rect.top - 15,
                        transform: 'translate(-50%, -100%)' 
                    }}
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                >
                    <div className="w-96 bg-[#0a0a0c]/95 border border-white/10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden border-t-white/20">
                        {/* Header Area with Surface Form */}
                        <div className="bg-gradient-to-b from-white/5 to-transparent p-8 pb-4">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <h4 className="text-3xl font-black text-white tracking-tight drop-shadow-2xl">{hoveredToken.word.surface}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-sky-400 font-black tracking-widest uppercase bg-sky-400/10 px-2.5 py-1 rounded-lg border border-sky-400/20">
                                            {hoveredToken.word.reading || '...'}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                            {hoveredToken.word.pos || 'Word'}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
                                    <Zap size={20} />
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-8 pb-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                    {hoveredToken.word.meanings && hoveredToken.word.meanings.length > 0 ? (
                                        hoveredToken.word.meanings.map((m: string, i: number) => (
                                            <div key={i} className="flex gap-4 text-sm text-slate-200 leading-relaxed group/item bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                                <span className="text-sky-500 font-black text-xs opacity-60 mt-0.5">{i+1}</span>
                                                <p className="font-medium tracking-wide">{m}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-white/5 p-4 rounded-2xl border border-dashed border-white/10 text-center">
                                            <p className="text-[11px] text-slate-600 italic font-medium">No detailed definition found offline.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Lemma / Meta */}
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Form</span>
                                </div>
                                <span className="text-xs font-bold text-sky-200">{hoveredToken.word.lemma || hoveredToken.word.surface}</span>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-3 pointer-events-auto pt-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddToVocab(hoveredToken.word); }}
                                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-sky-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-sky-400 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_30px_rgba(14,165,233,0.3)] group/btn"
                                >
                                    <Plus size={18} strokeWidth={4} className="group-hover:rotate-90 transition-transform" /> 
                                    Add To Vocab
                                </button>
                                <a 
                                    href={`https://jisho.org/search/${hoveredToken.word.lemma || hoveredToken.word.surface}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-16 flex items-center justify-center bg-white/5 rounded-2xl text-slate-500 hover:bg-white/10 hover:text-white transition-all border border-white/10 group/link"
                                    title="View on Jisho"
                                >
                                    <ExternalLink size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
