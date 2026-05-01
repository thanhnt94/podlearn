import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, ChevronDown, Trash2, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

export const OverviewPanel: React.FC = () => {
    const { user } = useAppStore();
    const {
        curatedContent,
        isEditingCurated: isEditing,
        setEditingCurated,
        draftCuratedContent: editedContent,
        setDraftCuratedContent: setEditedContent
    } = usePlayerStore();

    const [activeTabId, setActiveTabId] = useState<string>('overview');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isAdmin = user?.is_vip || user?.is_admin;

    // Sync active tab if deleted or on first load
    useEffect(() => {
        const sections = isEditing ? editedContent : curatedContent;
        if (sections.length > 0 && !sections.find(s => s.id === activeTabId)) {
            setActiveTabId(sections[0].id);
        } else if (sections.length === 0) {
            setActiveTabId('');
        }
    }, [curatedContent, editedContent, isEditing, activeTabId]);


    const handleAddTab = () => {
        // Automatically enter edit mode if not already in it
        if (!isEditing) {
            setEditingCurated(true);
            setEditedContent(curatedContent);
        }

        const id = `tab_${Date.now()}`;
        const newSection = { id, title: 'Tab mới', content: '' };

        // Use a functional update to ensure we have the latest content if we just entered edit mode
        if (!isEditing) {
            setEditedContent([...curatedContent, newSection]);
        } else {
            setEditedContent([...editedContent, newSection]);
        }
        setActiveTabId(id);
    };

    const handleDeleteTab = (id: string) => {
        if (!confirm("Xóa tab này?")) return;
        setEditedContent(editedContent.filter(s => s.id !== id));
    };

    const handleUpdateTabTitle = (id: string, title: string) => {
        setEditedContent(editedContent.map(s => s.id === id ? { ...s, title } : s));
    };

    const handleUpdateContent = (content: string) => {
        setEditedContent(editedContent.map(s => s.id === activeTabId ? { ...s, content } : s));
    };

    const sections = isEditing ? editedContent : curatedContent;

    // If total tabs > 3, we switch to a single "Dropdown Selector" mode for ALL tabs
    // Otherwise, we show individual buttons.
    const useFullDropdownMode = sections.length > 3;

    const activeSection = sections.find(s => s.id === activeTabId) || sections[0];

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            {/* ─── TAB BAR ─── */}
            <div className="px-4 pb-3 flex gap-2 items-center shrink-0">
                {!useFullDropdownMode ? (
                    // SHOW INDIVIDUAL BUTTONS (for 1-3 tabs)
                    <div className="flex gap-2 items-center">
                        {sections.map(tab => (
                            <SubTabButton
                                key={tab.id}
                                active={activeTabId === tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                label={tab.title}
                                isEditing={isEditing}
                                onDelete={() => handleDeleteTab(tab.id)}
                                color="sky"
                            />
                        ))}
                    </div>
                ) : (
                    // SHOW SINGLE DROPDOWN SELECTOR (for > 3 tabs)
                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-400 shadow-lg shadow-sky-500/10 transition-all hover:bg-sky-500/20 active:scale-95 min-w-[160px]"
                        >
                            <BookOpen size={14} className="opacity-70" />
                            <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">
                                {activeSection?.title || 'Chọn Tab'}
                            </span>
                            <ChevronDown size={14} className={`ml-auto transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full left-0 mt-2 w-64 bg-[#0f172a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden p-1 backdrop-blur-xl"
                                >
                                    <div className="px-3 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 mb-1">
                                        Danh sách nội dung
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {sections.map(tab => (
                                            <div key={tab.id} className="flex items-center group">
                                                <button
                                                    onClick={() => { setActiveTabId(tab.id); setIsMenuOpen(false); }}
                                                    className={`flex-1 text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTabId === tab.id ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                                                        }`}
                                                >
                                                    {tab.title}
                                                </button>
                                                {isEditing && (
                                                    <button
                                                        onClick={() => handleDeleteTab(tab.id)}
                                                        className="p-3 text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* ALWAYS VISIBLE ADD BUTTON */}
                {isAdmin && (
                    <button
                        onClick={handleAddTab}
                        className="p-2.5 bg-white/5 text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-2xl border border-dashed border-white/10 hover:border-sky-500/30 transition-all active:scale-90 flex items-center justify-center"
                        title="Thêm tab mới"
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            {/* ─── CONTENT AREA ─── */}
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                {isEditing ? (
                    <div className="h-full flex flex-col gap-4">
                        {activeSection ? (
                            <>
                                <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 rounded-2xl border border-white/5">
                                    <Edit3 size={14} className="text-sky-500" />
                                    <input
                                        value={activeSection.title}
                                        onChange={(e) => handleUpdateTabTitle(activeSection.id, e.target.value)}
                                        className="bg-transparent border-none outline-none text-white text-xs font-black uppercase tracking-widest w-full"
                                        placeholder="Tên tab..."
                                    />
                                </div>
                                <textarea
                                    className="flex-1 min-h-[400px] bg-slate-900/80 border border-white/10 rounded-2xl p-6 text-slate-300 font-sans text-sm focus:outline-none focus:border-sky-500/50 transition-all shadow-inner resize-none custom-scrollbar"
                                    value={activeSection.content}
                                    onChange={(e) => handleUpdateContent(e.target.value)}
                                    placeholder={`Nhập nội dung Markdown cho ${activeSection.title}...`}
                                />
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-600 opacity-40 italic text-sm">
                                Chọn hoặc thêm tab để bắt đầu biên soạn
                            </div>
                        )}
                    </div>
                ) : (
                    activeSection ? (
                        <div className="pod-markdown">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                            >
                                {activeSection.content}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-700">
                            <BookOpen size={60} strokeWidth={1} className="mb-6 opacity-20 animate-pulse" />
                            <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-40">Chưa có nội dung cho phần này</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

const SubTabButton: React.FC<{
    active: boolean;
    onClick: () => void;
    label: string;
    isEditing?: boolean;
    onDelete?: () => void;
    color: string
}> = ({ active, onClick, label, isEditing, onDelete, color }) => {
    const colors: Record<string, string> = {
        sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={onClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${active ? `${colors[color]} shadow-lg shadow-${color}-500/10` : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                    }`}
            >
                {label}
            </button>
            {isEditing && active && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                    className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
    );
};
{ label }
            </button >
    { isEditing && active && (
        <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
        >
            <Trash2 size={12} />
        </button>
    )}
        </div >
    );
};
