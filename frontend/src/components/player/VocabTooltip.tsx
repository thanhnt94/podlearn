import React from 'react';
import { createPortal } from 'react-dom';
import { Plus, ExternalLink, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface VocabTooltipProps {
    hoveredToken: { word: any; rect: DOMRect } | null;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onAddVocab: (word: any) => void;
    onAddNote: (word: any) => void;
}

export const VocabTooltip: React.FC<VocabTooltipProps> = ({ 
    hoveredToken, 
    onMouseEnter, 
    onMouseLeave,
    onAddVocab,
    onAddNote
}) => {
    if (!hoveredToken) return null;

        // 2. Function to parse Furigana: Kanji{furigana} -> <ruby>Kanji<rt>furigana</rt></ruby>
        const processFurigana = (txt: string) => {
            const regex = /([^\x00-\x7F]+)\{([^\}]+)\}/g; // Matches Kanji/non-ascii followed by {furigana}
            const elements = [];
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(txt)) !== null) {
                if (match.index > lastIndex) {
                    elements.push(txt.substring(lastIndex, match.index));
                }
                elements.push(
                    <ruby key={match.index}>
                        {match[1]}
                        <rt style={{ fontSize: '0.5em', opacity: 0.8 }}>{match[2]}</rt>
                    </ruby>
                );
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < txt.length) {
                elements.push(txt.substring(lastIndex));
            }
            return elements.length > 0 ? elements : txt;
        };

    const term = hoveredToken.word.lemma && hoveredToken.word.lemma !== 'skip' 
        ? hoveredToken.word.lemma 
        : hoveredToken.word.surface;
    
    // Clean term for external lookup (remove Furigana syntax)
    const cleanLookupTerm = term.replace(/\{[^\}]+\}/g, '');

    return createPortal(
        <div 
            className="fixed z-[99999] origin-bottom animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
            style={{ 
                left: hoveredToken.rect.left + hoveredToken.rect.width / 2, 
                top: hoveredToken.rect.top - 15,
                transform: 'translate(-50%, -100%)' 
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="w-80 bg-[#0a0a0c]/95 border border-white/10 rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden border-t-white/20">
                <div className="bg-gradient-to-b from-white/5 to-transparent p-5 pb-3">
                    <div className="flex justify-between items-start mb-2">
                        <div className="space-y-0.5">
                            <h4 className="text-2xl font-black text-white tracking-tight leading-tight">
                                {processFurigana(term)}
                            </h4>
                            {hoveredToken.word.lemma && hoveredToken.word.lemma !== hoveredToken.word.surface && hoveredToken.word.lemma !== 'skip' && (
                                <div className="text-slate-500 text-xs font-bold flex items-center gap-1.5 opacity-80">
                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase">Dạng gốc</span>
                                    {processFurigana(hoveredToken.word.surface)}
                                </div>
                            )}
                            <div className="flex items-center gap-3 pt-1">
                                <span className="text-[11px] text-sky-400 font-black tracking-widest uppercase bg-sky-400/10 px-2.5 py-1 rounded-lg border border-sky-400/20">
                                    {hoveredToken.word.reading || '...'}
                                </span>
                                {hoveredToken.word.metadata?.kanji_viet && (
                                    <span className="text-[11px] text-amber-400 font-black tracking-widest uppercase bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                                        {hoveredToken.word.metadata.kanji_viet}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAddVocab(hoveredToken.word); }}
                                className="w-8 h-8 flex items-center justify-center bg-sky-500 text-slate-950 rounded-lg hover:bg-sky-400 hover:scale-[1.05] active:scale-95 transition-all shadow-lg shadow-sky-500/20"
                                title="Add to Vocab"
                            >
                                <Plus size={16} strokeWidth={4} />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAddNote(hoveredToken.word); }}
                                className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 hover:scale-[1.05] active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                                title="Add to Note"
                            >
                                <RotateCcw size={16} strokeWidth={4} />
                            </button>
                            <a 
                                href={`https://jisho.org/search/${cleanLookupTerm}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-400 rounded-lg border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                                title="Search on Jisho"
                            >
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
                
                <div className="px-5 pb-5">
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1.5 text-slate-300 text-[13px] leading-relaxed font-medium">
                        {hoveredToken.word.meanings && hoveredToken.word.meanings.length > 0 ? (
                            hoveredToken.word.meanings.map((m: string, i: number) => (
                                <div key={i} className="flex gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                    <span className="text-sky-500 font-black text-[10px] opacity-60 mt-0.5">{i+1}</span>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {m}
                                    </ReactMarkdown>
                                </div>
                            ))
                        ) : (
                            <p className="text-[11px] text-slate-600 italic text-center p-2">No definition found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
