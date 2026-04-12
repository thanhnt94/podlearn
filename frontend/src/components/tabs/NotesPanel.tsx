import React, { useState } from 'react';
import { Plus, Trash2, Clock, Send, X } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

export const NotesPanel: React.FC = () => {
  const { notes, lessonId, requestSeek, addNote, deleteNote, setPlaying, currentTime } = usePlayerStore();
  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddClick = () => {
      setPlaying(false); // Pause as in legacy
      setIsAdding(true);
  };

  const handleSubmit = async () => {
    if (!content.trim() || !lessonId) return;
    setIsSubmitting(true);
    try {
      const data = (window as any).__PODLEARN_DATA__;
      const res = await axios.post(`/api/lesson/${lessonId}/notes`, {
        timestamp: currentTime,
        content: content
      }, {
        headers: { 'X-CSRF-Token': data.csrf_token }
      });
      
      addNote(res.data.note);
      setContent('');
      setIsAdding(false);
      setPlaying(true);
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure?")) return;
    try {
      const data = (window as any).__PODLEARN_DATA__;
      await axios.delete(`/api/notes/${id}`, {
        headers: { 'X-CSRF-Token': data.csrf_token }
      });
      deleteNote(id);
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
          <div className="p-4 bg-emerald-500/5 border-b border-white/10 space-y-3">
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
          </div>
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
          notes.map((note) => (
            <div 
              key={note.id}
              onClick={() => requestSeek(note.timestamp)}
              className="group bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 transition-all cursor-pointer relative"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full tabular-nums">
                      {formatTime(note.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed indent-0">
                    {note.content}
                  </p>
                </div>
                <button 
                   onClick={(e) => handleDelete(e, note.id)}
                   className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Internal Import helper
import { AnimatePresence } from 'framer-motion';
