import React from 'react';
import { createPortal } from 'react-dom';
import { Plus, Zap, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface VocabTooltipProps {
    hoveredToken: { word: any; rect: DOMRect } | null;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onSave: (word: any) => void;
}

export const VocabTooltip: React.FC<VocabTooltipProps> = ({ 
    hoveredToken, 
    onMouseEnter, 
    onMouseLeave,
    onSave
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
            <div className="w-96 bg-[#0a0a0c]/95 border border-white/10 rounded-[2.5rem] shadow-[0_40px_100_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden border-t-white/20">
                <div className="bg-gradient-to-b from-white/5 to-transparent p-8 pb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <h4 className="text-3xl font-black text-white tracking-tight leading-loose">
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
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
                            <Zap size={20} />
                        </div>
                    </div>
                </div>
                
                <div className="px-8 pb-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2 text-slate-300 text-sm leading-relaxed font-medium">
                            {hoveredToken.word.meanings && hoveredToken.word.meanings.length > 0 ? (
                                hoveredToken.word.meanings.map((m: string, i: number) => (
                                    <div key={i} className="flex gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                                        <span className="text-sky-500 font-black text-xs opacity-60 mt-0.5">{i+1}</span>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                            {m}
                                        </ReactMarkdown>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[11px] text-slate-600 italic text-center p-4">No definition found.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pointer-events-auto pt-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onSave(hoveredToken.word); }}
                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-sky-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-sky-400 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                        >
                            <Plus size={18} strokeWidth={4} /> Add To Vocab
                        </button>
                        <a 
                            href={`https://jisho.org/search/${cleanLookupTerm}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 flex items-center justify-center bg-white/5 rounded-2xl text-slate-500 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                        >
                            <ExternalLink size={18} />
                        </a>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
