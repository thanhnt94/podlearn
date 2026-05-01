import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { usePlayerStore } from '../../store/usePlayerStore';

export const OverviewPanel: React.FC = () => {
    const { 
        curatedContent, 
        isEditingCurated: isEditing, 
        draftCuratedContent: editedContent,
        setDraftCuratedContent: setEditedContent
    } = usePlayerStore();
    const [sub, setSub] = useState<'overview' | 'grammar' | 'vocab'>('overview');

    const renderContent = (key: 'overview' | 'grammar' | 'vocabulary') => {
        const text = isEditing ? editedContent[key] : curatedContent[key];
        
        if (isEditing) {
            return (
                <textarea 
                    className="w-full h-[400px] bg-slate-900 border border-white/10 rounded-xl p-4 text-slate-300 font-sans text-sm focus:outline-none focus:border-sky-500 transition-colors"
                    value={text}
                    onChange={(e) => setEditedContent({ [key]: e.target.value })}
                    placeholder={`Nhập nội dung ${sub}...`}
                />
            );
        }
        
        if (!text) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                    <BookOpen size={40} strokeWidth={1} className="mb-4 opacity-20" />
                    <p className="text-xs uppercase tracking-widest font-black">Chưa có nội dung tổng hợp</p>
                </div>
            );
        }

        return (
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed font-sans prose-headings:text-white prose-strong:text-sky-400 prose-code:text-emerald-400 prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-white/5 prose-li:my-1 prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:p-2 prose-th:bg-white/5 prose-td:border prose-td:border-white/10 prose-td:p-2">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                >
                    {text}
                </ReactMarkdown>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pb-3 flex gap-2 items-center shrink-0">
                <button 
                    onClick={() => setSub('overview')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'overview' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Tổng quan
                </button>
                <button 
                    onClick={() => setSub('grammar')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'grammar' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Ngữ pháp
                </button>
                <button 
                    onClick={() => setSub('vocab')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'vocab' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Từ vựng
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                {renderContent(sub === 'vocab' ? 'vocabulary' : sub)}
            </div>
        </div>
    );
};
