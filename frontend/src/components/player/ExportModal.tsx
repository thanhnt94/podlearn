import React, { useState } from 'react';
import { X, Copy, Printer, Check, Languages, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
    const { subtitles, s2Lines, s3Lines, lessonTitle } = usePlayerStore();
    const [options, setOptions] = useState({
        showS1: true,
        showS2: true,
        showS3: false,
        showTimestamp: true,
        compact: false
    });
    const [copied, setCopied] = useState(false);

    const getAlternativeLines = (s1Line: any) => {
        const findBestMatch = (lines: any[]) => {
            if (!lines || lines.length === 0) return undefined;
            return lines.find(l => (s1Line.start <= l.end) && (s1Line.end >= l.start));
        };
        return { s2: findBestMatch(s2Lines), s3: findBestMatch(s3Lines) };
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' + s : s}`;
    };

    const generateText = () => {
        return subtitles.map(line => {
            let part = '';
            if (options.showTimestamp) part += `[${formatTime(line.start)}] `;
            const parts = [];
            if (options.showS1) parts.push(line.text);
            const alts = getAlternativeLines(line);
            if (options.showS2 && alts.s2) parts.push(alts.s2.text);
            if (options.showS3 && alts.s3) parts.push(alts.s3.text);
            
            return part + parts.join(options.compact ? ' | ' : '\n');
        }).join('\n\n');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateText());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl max-h-full bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Export Lesson Script</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{lessonTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Sidebar Options */}
                    <div className="w-full md:w-64 p-6 border-b md:border-b-0 md:border-r border-white/5 bg-slate-950/30 space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Select Content</h3>
                            <div className="space-y-2">
                                {[
                                    { id: 'showS1', label: 'Original Text', icon: Languages },
                                    { id: 'showS2', label: 'Translation 1', icon: Languages },
                                    { id: 'showS3', label: 'Translation 2', icon: Languages },
                                    { id: 'showTimestamp', label: 'Timestamps', icon: FileText },
                                ].map(opt => (
                                    <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group">
                                        <input 
                                            type="checkbox" 
                                            checked={(options as any)[opt.id]} 
                                            onChange={() => setOptions(prev => ({ ...prev, [opt.id]: !(prev as any)[opt.id] }))}
                                            className="hidden"
                                        />
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${(options as any)[opt.id] ? 'bg-sky-500 border-sky-500' : 'border-white/10 group-hover:border-white/20'}`}>
                                            {(options as any)[opt.id] && <Check size={12} strokeWidth={4} className="text-slate-950" />}
                                        </div>
                                        <span className={`text-xs font-bold transition-colors ${(options as any)[opt.id] ? 'text-white' : 'text-slate-500'}`}>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Layout</h3>
                            <button 
                                onClick={() => setOptions(prev => ({ ...prev, compact: !prev.compact }))}
                                className={`w-full p-3 rounded-xl text-xs font-bold transition-all border ${options.compact ? 'bg-white text-slate-950 border-white' : 'text-slate-400 border-white/10 hover:border-white/20'}`}
                            >
                                {options.compact ? 'Compact (Inline)' : 'Standard (Stacked)'}
                            </button>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap print:text-black print:bg-white">
                            <div className="max-w-2xl mx-auto space-y-6">
                                {subtitles.map((line, i) => {
                                    const alts = getAlternativeLines(line);
                                    return (
                                        <div key={i} className="space-y-1 print:break-inside-avoid">
                                            {options.showTimestamp && (
                                                <span className="text-[10px] text-sky-500/50 font-bold mr-2 uppercase">{formatTime(line.start)}</span>
                                            )}
                                            <div className={options.compact ? 'inline-block' : 'space-y-1'}>
                                                {options.showS1 && <span className="text-white block font-sans text-base">{line.text}</span>}
                                                {options.showS2 && alts.s2 && <span className="text-emerald-500/80 block font-sans">{alts.s2.text}</span>}
                                                {options.showS3 && alts.s3 && <span className="text-amber-500/80 block font-sans">{alts.s3.text}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-white/5 bg-slate-900/50 flex items-center justify-between gap-4">
                            <button 
                                onClick={handlePrint}
                                className="px-6 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2"
                            >
                                <Printer size={16} /> Print PDF
                            </button>
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleCopy}
                                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${copied ? 'bg-emerald-500 text-slate-950' : 'bg-white text-slate-950 hover:bg-sky-400'}`}
                                >
                                    {copied ? <><Check size={16} strokeWidth={3} /> Copied</> : <><Copy size={16} /> Copy Script</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
