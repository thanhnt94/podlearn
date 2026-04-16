import React, { useState, useEffect } from 'react';
import { Send, Clock, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';

export const CommunityPanel: React.FC = () => {
    const { 
        lessonId, comments, fetchComments, addComment, 
        currentTime, requestSeek 
    } = usePlayerStore();
    
    const [newComment, setNewComment] = useState('');
    const [useCurrentTime, setUseCurrentTime] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (lessonId) {
            fetchComments(lessonId);
        }
    }, [lessonId, fetchComments]);

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !lessonId) return;

        setIsSubmitting(true);
        const timestamp = useCurrentTime ? currentTime : undefined;
        await addComment(lessonId, newComment, timestamp);
        setNewComment('');
        setIsSubmitting(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' + s : s}`;
    };

    return (
        <div className="flex flex-col h-full bg-slate-950/50">
            {/* Post Comment Form */}
            <div className="p-4 border-b border-white/5 bg-slate-900/40 rounded-2xl mb-4 backdrop-blur-sm">
                <form onSubmit={handlePost} className="space-y-3">
                    <div className="relative">
                        <textarea 
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Chia sẻ ý kiến hoặc thắc mắc của bạn..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 min-h-[80px] transition-all"
                        />
                        <button 
                            type="submit"
                            disabled={isSubmitting || !newComment.trim()}
                            className="absolute bottom-3 right-3 p-2 bg-sky-500 text-slate-950 rounded-lg hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setUseCurrentTime(!useCurrentTime)}>
                            <div className={`w-8 h-4 rounded-full transition-all relative ${useCurrentTime ? 'bg-sky-500' : 'bg-slate-800'}`}>
                                <motion.div 
                                    animate={{ x: useCurrentTime ? 16 : 2 }}
                                    className="w-3 h-3 bg-white rounded-full absolute top-0.5" 
                                />
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-400">
                                Gắn tại {formatTime(currentTime)}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase italic">
                            {comments.length} Comments
                        </span>
                    </div>
                </form>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-700 opacity-50">
                        <MessageCircle size={48} strokeWidth={1} />
                        <p className="text-xs font-black uppercase mt-4 tracking-widest">Chưa có bình luận nào</p>
                        <p className="text-[10px] lowercase mt-1 italic">Hãy là người đầu tiên chia sẻ!</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {comments.map((comment, idx) => (
                            <motion.div 
                                key={comment.id || idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="group bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <img 
                                        src={comment.user.avatar_url} 
                                        alt={comment.user.username}
                                        className="w-8 h-8 rounded-xl object-cover border border-white/10"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-slate-300 truncate tracking-tight">{comment.user.username}</span>
                                            {comment.video_timestamp !== null && (
                                                <button 
                                                    onClick={() => requestSeek(comment.video_timestamp)}
                                                    className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded-md hover:bg-sky-500 hover:text-slate-950 transition-all text-[9px] font-black font-mono"
                                                >
                                                    <Clock size={10} />
                                                    {formatTime(comment.video_timestamp)}
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed break-words">
                                            {comment.content}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
