import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, Zap, Loader2, GripVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { soundEffects } from '../../services/SoundEffectsService';
import { VocabTooltip } from './VocabTooltip';

const TokenEditChip = ({ token, isLast, onMerge, onDelete, onClick }: any) => {
    const isSkip = ['-', 's', 'skip'].includes(token.lemma_override);

    return (
        <div 
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl group relative transition-all duration-300 border cursor-pointer ${
                isSkip 
                ? 'bg-slate-900/20 border-white/5 opacity-30 scale-90 grayscale' 
                : 'bg-slate-900 border-white/10 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]'
            }`}
        >
            <div className="min-w-[30px] px-1 flex flex-col items-center">
                <span className={`text-sm font-bold tracking-tight transition-colors ${isSkip ? 'text-slate-600' : 'text-amber-200 group-hover:text-white'}`}>
                    {token.surface}
                </span>
                {token.lemma_override && token.lemma_override !== 'skip' && (
                    <span className="text-[9px] text-amber-500/40 font-black uppercase tracking-widest -mt-0.5">
                        {token.lemma_override}
                    </span>
                )}
                {isSkip && (
                    <span className="text-[8px] text-rose-500/60 font-black uppercase tracking-[0.2em] -mt-0.5">-</span>
                )}
            </div>

            <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                {!isLast && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMerge(); }} 
                        className="p-1.5 text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"
                        title="Merge with next"
                    >
                        <GripVertical size={14} />
                    </button>
                )}
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                    className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Remove token"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export const LearningFocusBar: React.FC = () => {
    const { 
        analyzedWords, 
        subtitles,
        activeLineIndex,
        lessonId,
        appendNote,
        checkScanStatus,
        fetchAnalyzedWords,
        scanFullLesson,
        setPlaying,
        isPlaying,
        isEditingSegmentation,
        toggleEditingSegmentation,
        autoSegmentationEnabled
    } = usePlayerStore();

    const [editTokens, setEditTokens] = React.useState<any[]>([]);
    const [isScanningGlobal, setIsScanningGlobal] = React.useState(false);

    const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
    const [editValue, setEditValue] = React.useState('');
    const [editSkip, setEditSkip] = React.useState(false);

    const openEditor = (idx: number) => {
        const token = editTokens[idx];
        setEditingIdx(idx);
        setEditValue(token.surface);
        setEditSkip(['-', 's', 'skip'].includes(token.lemma_override));
    };

    const applyTokenChanges = () => {
        if (editingIdx === null) return;
        const newTokens = [...editTokens];
        newTokens[editingIdx] = { 
            ...newTokens[editingIdx], 
            surface: editValue.trim(), 
            lemma_override: editSkip ? '-' : (['-', 's', 'skip'].includes(newTokens[editingIdx].lemma_override) ? null : newTokens[editingIdx].lemma_override)
        };
        setEditTokens(newTokens);
        setEditingIdx(null);
    };

    // Tooltip State
    const [hoveredToken, setHoveredToken] = React.useState<{word: any, rect: DOMRect} | null>(null);
    const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const wasPlayingBeforeHover = React.useRef<boolean>(false);

    const handleTokenMouseEnter = (e: React.MouseEvent, word: any) => {
        if (['-', 's', 'skip'].includes(word.lemma_override) || ['-', 's', 'skip'].includes(word.lemma)) return;
        
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        const rect = e.currentTarget.getBoundingClientRect();
        
        // Remember if it was playing before we forced pause
        if (hoveredToken === null) {
            wasPlayingBeforeHover.current = isPlaying;
        }
        
        setHoveredToken({ word, rect });
        setPlaying(false);
    };

    const handleTokenMouseLeave = () => {
        tooltipTimer.current = setTimeout(() => {
            setHoveredToken(null);
            // Resume if it was playing before
            if (wasPlayingBeforeHover.current) {
                setPlaying(true);
            }
        }, 150);
    };

    const handleTooltipMouseEnter = () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };

    const handleTooltipMouseLeave = () => {
        tooltipTimer.current = setTimeout(() => {
            setHoveredToken(null);
            // Resume if it was playing before
            if (wasPlayingBeforeHover.current) {
                setPlaying(true);
            }
        }, 150);
    };

    const handleStartScan = async () => {
        // Try to get lessonId from store or URL as fallback
        const effectiveId = lessonId || parseInt(window.location.pathname.split('/').pop() || '0');
        
        console.log("Starting scan for lesson:", effectiveId);
        if (!effectiveId || effectiveId === 0) {
            console.error("No lessonId found for scan");
            return;
        }

        setIsScanningGlobal(true);
        try {
            await scanFullLesson('mazii_offline');
            await checkScanStatus();
            console.log("Scan completed successfully");
        } catch (e) {
            console.error("Scan error in FocusBar:", e);
        } finally {
            setIsScanningGlobal(false);
        }
    };

    React.useEffect(() => {
        if (lessonId) checkScanStatus();
    }, [lessonId]);

    const handleAddToVocab = async (word: any) => {
        if (!lessonId) return;
        const termToSave = (word.lemma || word.surface).replace(/\{[^\}]+\}/g, '');
        try {
            const meaning = Array.isArray(word.meanings) ? word.meanings.join(', ') : (word.meanings || '');
            await usePlayerStore.getState().addVocab(termToSave, word.reading || '', meaning);
            
            soundEffects.vibrate(50);
        } catch (err) {
            console.error("Save failed", err);
        }
    };

    const handleAddNote = async (word: any) => {
        if (!lessonId) return;
        const currentLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;
        const timestamp = currentLine ? currentLine.start : 0;
        const exampleText = (currentLine ? currentLine.text : '').replace(/\|/g, '').replace(/\{[^\}]+\}/g, '');
        
        const noteContent = `**${word.lemma || word.surface}**${word.reading ? ` [${word.reading}]` : ''}\n${Array.isArray(word.meanings) ? word.meanings.join(', ') : word.meanings}\n\n*${exampleText}*`;
        
        try {
            const response = await axios.post(`/api/study/lesson/${lessonId}/notes`, {
                timestamp: timestamp,
                content: noteContent
            });
            
            if (response.data.success) {
                appendNote(response.data.note);
                soundEffects.vibrate(50);
            }
        } catch (err) {
            console.error("Note failed", err);
        }
    };

    const handleMergeTokens = (idx: number) => {
        if (idx >= editTokens.length - 1) return;
        const newTokens = [...editTokens];
        const next = newTokens[idx + 1];
        newTokens[idx] = {
            ...newTokens[idx],
            surface: newTokens[idx].surface + next.surface,
            lemma_override: null // Reset lemma on merge
        };
        newTokens.splice(idx + 1, 1);
        setEditTokens(newTokens);
    };

    const startEditing = () => {
        setEditTokens(analyzedWords.map((w: any) => ({
            surface: w.surface,
            lemma_override: w.lemma_override || (w.lemma && w.lemma !== w.surface ? w.lemma : null)
        })));
    };

    // React to global edit state
    React.useEffect(() => {
        if (isEditingSegmentation && editTokens.length === 0) {
            startEditing();
        } else if (!isEditingSegmentation && editTokens.length > 0) {
            // If turned off from outside, we might want to save or discard
            // For now, just clear
            setEditTokens([]);
        }
    }, [isEditingSegmentation]);

    const saveEditing = async () => {
        if (!lessonId || activeLineIndex === -1) return;
        try {
            await axios.post('/api/study/vocab/tokens/save', {
                lesson_id: lessonId,
                line_index: activeLineIndex,
                tokens: editTokens
            });
            await fetchAnalyzedWords(currentLine?.text || '', 'ja');
            await checkScanStatus();
            toggleEditingSegmentation(false);
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    const resetEditing = async () => {
        if (!lessonId || activeLineIndex === -1) return;
        if (!confirm("Reset segmentation for this line?")) return;
        try {
            await axios.delete('/api/study/vocab/tokens/clear', {
                data: { lesson_id: lessonId, line_index: activeLineIndex }
            });
            await fetchAnalyzedWords(currentLine?.text || '', 'ja');
            toggleEditingSegmentation(false);
        } catch (e) { console.error(e); }
    };

    const currentLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;

    // AUTO-ANALYZE
    React.useEffect(() => {
        if (currentLine && autoSegmentationEnabled && analyzedWords.length === 0) {
            fetchAnalyzedWords(currentLine.text, 'ja');
        }
    }, [activeLineIndex, autoSegmentationEnabled]);

    if (!currentLine) return (
        <div className="w-full bg-slate-950/80 border-t border-white/5 backdrop-blur-xl px-4 py-2 min-h-[70px] md:min-h-[90px] flex items-center justify-center z-[999] relative">
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Playback idle • Select a line to start analysis</p>
        </div>
    );

    return (
        <div className="w-full bg-slate-950/90 border-t border-white/10 backdrop-blur-3xl px-4 py-1 min-h-[70px] md:min-h-[90px] flex flex-col shadow-[0_-30px_60px_rgba(0,0,0,0.8)] relative transition-all duration-500 z-[999]">
            {/* Premium Top Border Gradient */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
            
            {/* NEEDS SCAN STATE - STATIC FLOW */}
            {/* NEEDS SCAN STATE - ONLY IF AUTO SEGMENTATION IS ON AND NO WORDS */}
            {analyzedWords.length === 0 && autoSegmentationEnabled ? (
                <div className="w-full h-full flex items-center justify-center">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-8 px-8 py-4 rounded-[32px] border border-amber-500/30 bg-amber-500/5 shadow-2xl backdrop-blur-2xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                <Zap size={20} fill="currentColor" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-white font-black text-xs uppercase tracking-widest leading-none">Lesson Scan Required</h3>
                                <p className="text-slate-400 text-[9px] font-medium mt-1">Enable smart analysis in Vocab tab</p>
                            </div>
                        </div>
                        
                        <div className="h-8 w-px bg-white/10" />
                        
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStartScan();
                            }}
                            disabled={isScanningGlobal}
                            className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center gap-3 relative z-[1000] cursor-pointer active:scale-90 active:brightness-125 ${
                                isScanningGlobal 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:scale-105 shadow-amber-500/40 border-b-4 border-amber-700'
                            }`}
                        >
                            {isScanningGlobal ? (
                                <><Loader2 size={18} className="animate-spin" /> ANALYZING...</>
                            ) : (
                                <>START ANALYSIS NOW</>
                            )}
                        </button>
                    </motion.div>
                    </div>
                ) : (
                <div className="w-full h-full relative flex items-center justify-center">
                    {/* Center: Content */}
                    <div className="w-full h-full overflow-hidden px-4 flex items-center justify-center">
                        <div className="flex flex-wrap items-end justify-center gap-x-2 md:gap-x-3 gap-y-1 md:gap-y-2 py-2 md:py-4">
                            {isEditingSegmentation ? (
                                <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 w-full relative">
                                    {editTokens.map((token, i) => (
                                        <TokenEditChip 
                                            key={i}
                                            token={token}
                                            isLast={i === editTokens.length - 1}
                                            onClick={() => openEditor(i)}
                                            onMerge={() => handleMergeTokens(i)}
                                            onDelete={() => setEditTokens(editTokens.filter((_, idx) => idx !== i))}
                                        />
                                    ))}
                                    <div className="flex items-center gap-4 ml-4">
                                        <button onClick={saveEditing} className="px-4 py-2 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-400 transition-all">Save</button>
                                        <button onClick={() => toggleEditingSegmentation(false)} className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg hover:bg-slate-700 transition-all">Cancel</button>
                                        <button onClick={resetEditing} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 hover:text-white transition-colors">
                                            <RotateCcw size={12} /> Reset
                                        </button>
                                    </div>

                                    {/* MODAL EDITOR OVERLAY */}
                                    {createPortal(
                                        <AnimatePresence>
                                            {editingIdx !== null && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4"
                                                    onClick={() => setEditingIdx(null)}
                                                >
                                                    <motion.div 
                                                        initial={{ scale: 0.9, y: 20 }}
                                                        animate={{ scale: 1, y: 0 }}
                                                        className="bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl w-full max-w-md flex flex-col gap-8"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <h2 className="text-white text-xl font-black uppercase tracking-[0.2em]">Edit Word</h2>
                                                            <button 
                                                                onClick={() => setEditSkip(!editSkip)}
                                                                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                                                                    editSkip ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'
                                                                }`}
                                                            >
                                                                {editSkip ? 'Skipped' : 'Skip word [-]'}
                                                            </button>
                                                        </div>

                                                        <input 
                                                            autoFocus
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') applyTokenChanges();
                                                                if (e.key === 'Escape') setEditingIdx(null);
                                                            }}
                                                            className="bg-slate-950 border border-white/5 text-3xl font-black text-amber-200 px-8 py-6 rounded-[30px] outline-none text-center focus:border-amber-500/40 transition-all shadow-inner"
                                                        />

                                                        <div className="flex gap-4">
                                                            <button 
                                                                onClick={applyTokenChanges}
                                                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-5 rounded-[25px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-amber-500/20"
                                                            >
                                                                Save Changes
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingIdx(null)}
                                                                className="px-8 bg-white/5 hover:bg-white/10 text-white font-black py-5 rounded-[25px] uppercase tracking-[0.2em] transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>,
                                        document.body
                                    )}
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {analyzedWords.length > 0 ? (
                                        analyzedWords.map((word: any, idx: number) => {
                                            const isSkip = ['-', 's', 'skip'].includes(word.lemma_override) || ['-', 's', 'skip'].includes(word.lemma) || word.pos === '助詞';
                                            return (
                                                <motion.div 
                                                    key={`${activeLineIndex}-${idx}`}
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`flex flex-col items-center justify-end group relative min-h-[40px] ${isSkip ? 'cursor-default opacity-30 grayscale scale-90' : 'cursor-help'}`}
                                                    onMouseEnter={isSkip ? undefined : ((e) => handleTokenMouseEnter(e, word))}
                                                    onMouseLeave={isSkip ? undefined : handleTokenMouseLeave}
                                                >
                                                    <span 
                                                        className={`text-[15px] md:text-[22px] font-black tracking-tight transition-all duration-300 leading-tight ${
                                                            isSkip ? 'text-slate-600' : 'text-white group-hover:text-sky-400 group-hover:drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]'
                                                        }`}
                                                    >
                                                        {word.surface.includes('{') ? (
                                                            word.surface.split(/([^\x00-\x7F]+\{[^\}]+\})/g).filter(Boolean).map((part: string, pIdx: number) => {
                                                                const match = part.match(/([^\x00-\x7F]+)\{([^\}]+)\}/);
                                                                if (match) {
                                                                    return (
                                                                        <ruby key={pIdx}>
                                                                            {match[1]}
                                                                            <rt style={{ fontSize: '0.45em', opacity: 0.8, color: '#38bdf8' }}>{match[2]}</rt>
                                                                        </ruby>
                                                                    );
                                                                }
                                                                return part;
                                                            })
                                                        ) : (
                                                            word.surface
                                                        )}
                                                    </span>
                                                </motion.div>
                                            );
                                        })
                                    ) : (
                                        <motion.span 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-xl md:text-2xl font-black text-slate-400 tracking-tight"
                                        >
                                            {(currentLine.text || '').replace(/\|/g, '')}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <VocabTooltip 
                hoveredToken={hoveredToken}
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
                onAddVocab={handleAddToVocab}
                onAddNote={handleAddNote}
            />
        </div>
    );
};
