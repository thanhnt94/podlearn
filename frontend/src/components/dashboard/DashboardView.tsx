import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LessonCard } from './LessonCard';
import { SkeletonDashboard } from './SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Flame, BookOpen, Search, 
    ArrowUpRight, Sparkles, Bell
} from 'lucide-react';

export const DashboardView: React.FC = () => {
    const { lessons, stats, notifications, isLoading, fetchDashboard } = useAppStore();

    useEffect(() => {
        fetchDashboard();
    }, []);

    if (isLoading) {
        return <SkeletonDashboard />;
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        show: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 15
            }
        }
    } as const;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar relative">
            {/* Mesh Background Layer */}
            <div className="mesh-bg pointer-events-none" />

            {/* 1. Dashboard Header (Stats & Search) */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto px-6 md:px-10 pt-12 pb-8 space-y-8 relative z-10"
            >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sky-400">
                            <Sparkles size={16} fill="currentColor" className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">AI-Powered Learning</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                            Your Studio <span className="text-sky-500">Hub</span>
                        </h1>
                    </div>

                    {/* Stats HUD */}
                    <div className="flex gap-4">
                        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-4 rounded-[2rem] flex items-center gap-4 transition-colors hover:border-orange-500/20">
                            <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
                                <Flame size={22} fill="currentColor" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Streak</p>
                                <p className="text-xl font-black text-white">{stats.current_streak} Days</p>
                            </div>
                        </motion.div>
                        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-4 rounded-[2rem] flex items-center gap-4 transition-colors hover:border-sky-500/20">
                            <div className="w-10 h-10 bg-sky-500/10 text-sky-500 rounded-2xl flex items-center justify-center">
                                <BookOpen size={22} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Mastery</p>
                                <p className="text-xl font-black text-white">{stats.completed_count}/{stats.total_lessons}</p>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <AnimatePresence>
                    {notifications.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-indigo-500/10 border border-indigo-500/20 rounded-[3rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                            
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 text-indigo-400 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10 group-hover:rotate-12 transition-transform duration-500">
                                    <Bell size={28} className="animate-bounce" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-indigo-100 uppercase tracking-tight">Pending invites</h3>
                                    <p className="text-sm text-indigo-200/50 font-medium">You have {notifications.length} invitations to collaborate in shared workspaces.</p>
                                </div>
                            </div>
                            <button className="px-8 py-4 bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-400 transition-all flex items-center gap-3 shadow-xl shadow-indigo-500/20 relative z-10">
                                Review Inbox <ArrowUpRight size={16} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* 2. Main Library Grid */}
            <div className="max-w-7xl mx-auto px-6 md:px-10 pb-20 space-y-12 relative z-10">
                <section className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">My Active Lessons</h2>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search library..." 
                                    className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 outline-none w-48 transition-all focus:w-80"
                                />
                            </div>
                        </div>
                    </div>

                    <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
                    >
                        {lessons.map(lesson => (
                            <motion.div key={lesson.id} variants={itemVariants}>
                                <LessonCard lesson={lesson} />
                            </motion.div>
                        ))}
                        {lessons.length === 0 && (
                            <motion.div 
                                variants={itemVariants}
                                className="col-span-full py-32 bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[4rem] text-center space-y-6 backdrop-blur-sm"
                            >
                                <div className="text-6xl grayscale">🎬</div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">Your library is empty</h3>
                                    <p className="text-[10px] text-slate-600 uppercase font-black tracking-[0.2em]">Import a podcast or join a lesson to start learning.</p>
                                </div>
                                <button className="mx-auto px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                                    Browse Explore
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                </section>
            </div>
        </div>
    );
};
