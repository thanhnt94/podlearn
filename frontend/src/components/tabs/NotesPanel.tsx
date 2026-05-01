import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Clock, Send, X, Edit2, Save } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export const NotesPanel: React.FC = () => {
  const { 
    notes, lessonId, requestSeek, addNote, deleteNote, 
    updateNote, setPlaying, currentTime, settings 
  } = usePlayerStore();
  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  // Auto-scroll refs
  const noteRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Auto-scroll logic
  useEffect(() => {
    const activeNote = notes.find(note => {
      const showAt = note.timestamp;
      const endAt = showAt + settings.notes.duration;
      const startAt = showAt - settings.notes.beforeSecs;
      return currentTime >= startAt && currentTime <= endAt;
    });

    if (activeNote && noteRefs.current[activeNote.id]) {
      noteRefs.current[activeNote.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime, notes, settings.notes.duration, settings.notes.beforeSecs]);

  const handleAddClick = () => {
      setPlaying(false); // Pause as in legacy
      setIsAdding(true);
  };

  const handleSubmit = async () => {
    if (!content.trim() || !lessonId) return;
    setIsSubmitting(true);
    try {
      await addNote(currentTime, content);
      setContent('');
      setIsAdding(false);
      setPlaying(true);
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    try {
      await updateNote(id, editContent);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update note", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure?")) return;
    try {
      await deleteNote(id);
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Lesson Notes
            <span className="px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px]">{notes.length}</span>
          </h3>
        </div>
        {!isAdding && (
          <button 
            onClick={handleAddClick}
            className="p-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-all shadow-lg shadow-sky-500/10"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4 bg-emerald-500/5 border-b border-white/10 space-y-3 overflow-hidden"
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400">
                    <Clock size={14} />
                    <span className="text-[10px] font-black tabular-nums">{formatTime(currentTime)}</span>
                </div>
                <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white">
                    <X size={14} />
                </button>
             </div>
             <textarea 
               autoFocus
               value={content}
               onChange={(e) => setContent(e.target.value)}
               placeholder="Write your note..."
               className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500/50 min-h-[80px]"
             />
             <button 
               onClick={handleSubmit}
               disabled={isSubmitting || !content.trim()}
               className="w-full py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
             >
               {isSubmitting ? 'Syncing...' : <><Send size={12} fill="currentColor" /> Save Note</>}
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
              <Plus size={24} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">No notes yet.<br/>Annotate your wisdom.</p>
          </div>
        ) : (
          notes.map((note) => {
            const showAt = note.timestamp;
            const endAt = showAt + settings.notes.duration;
            const startAt = showAt - settings.notes.beforeSecs;
            const isActive = currentTime >= startAt && currentTime <= endAt;
            
            return (
                <div 
                key={note.id}
                ref={(el) => { noteRefs.current[note.id] = el; }}
                onClick={() => editingId === null && requestSeek(note.timestamp)}
                className={`group bg-white/5 hover:bg-white/10 border transition-all relative rounded-2xl p-4 ${
                    isActive 
                        ? 'border-sky-500 bg-sky-500/5 shadow-[0_0_30px_rgba(14,165,233,0.1)] z-10' 
                        : editingId === note.id ? 'border-sky-500/30' : 'border-white/5 cursor-pointer'
                }`}
                >
              {editingId === note.id ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full tabular-nums">
                      {formatTime(note.timestamp)}
                    </span>
                    <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white p-1">
                      <X size={14} />
                    </button>
                  </div>
                  <textarea 
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500/50 min-h-[100px]"
                  />
                  <button 
                    onClick={() => handleUpdate(note.id)}
                    className="w-full py-1.5 bg-sky-500 text-slate-950 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                  >
                    <Save size={12} /> Update Note
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full tabular-nums">
                        {formatTime(note.timestamp)}
                      </span>
                    </div>
                    <div className="prose prose-invert max-w-none text-slate-300 text-[11px] leading-relaxed font-sans prose-headings:text-white prose-strong:text-sky-400 prose-code:text-emerald-400 prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-white/5 prose-li:my-1 prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:p-2 prose-th:bg-white/5 prose-td:border prose-td:border-white/10 prose-td:p-2">
                      <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                      >
                          {note.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setEditingId(note.id);
                         setEditContent(note.content);
                       }}
                       className="p-2 text-slate-500 hover:text-sky-400 transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                       onClick={(e) => handleDelete(e, note.id)}
                       className="p-2 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
};
