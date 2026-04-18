import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LessonCard } from './LessonCard';
import { 
    Flame, Search, 
    ArrowUpRight, Sparkles, Bell
} from 'lucide-react';

export const DashboardView: React.FC = () => {
    const { 
        lessons, stats, notifications, isLoading, 
        fetchDashboard, deleteLesson, deleteVideoGlobal,
        toggleVideoVisibility
    } = useAppStore();

    useEffect(() => {
        fetchDashboard();
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-slate-950">
                <div className="w-12 h-12 border-4 border-slate-800 border-t-sky-500 rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Preparing your studio...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar">
            {/* 1. Dashboard Header (Stats & Search) */}
            <div className="max-w-7xl mx-auto px-6 md:px-10 pt-12 pb-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sky-500">
                            <Sparkles size={16} fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Welcome Back</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Your Podcast Library</h1>
                    </div>

                    {/* Stats HUD */}
                    <div className="flex gap-4">
                        <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
                                <Flame size={20} fill="currentColor" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Current Streak</p>
                                <p className="text-xl font-black text-white">{stats.current_streak} Days</p>
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                                <ArrowUpRight size={20} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Library Completion</p>
                                <p className="text-xl font-black text-white">{stats.completed_count}/{stats.total_lessons}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications & Invites */}
                {notifications.length > 0 && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                                <Bell size={24} className="animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-indigo-200">You have {notifications.length} pending workspace invites</h3>
                                <p className="text-xs text-indigo-200/60 font-medium">Collaborate on podcasts with your peers and tutors.</p>
                            </div>
                        </div>
                        <button className="px-6 py-3 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-400 transition-all flex items-center gap-2">
                            Review Inbox <ArrowUpRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* 2. Main Library Grid */}
            <div className="max-w-7xl mx-auto px-6 md:px-10 pb-20 space-y-12">
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-sky-500 rounded-full" />
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">My Active Lessons</h2>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-sky-500 transition-colors" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search library..." 
                                    className="bg-slate-900 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs focus:border-sky-500/50 outline-none w-48 transition-all focus:w-64"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {lessons.map(lesson => (
                            <LessonCard 
                                key={lesson.id} 
                                lesson={lesson} 
                                onDelete={deleteLesson}
                                onDeleteGlobal={deleteVideoGlobal}
                                onToggleVisibility={toggleVideoVisibility}
                            />
                        ))}
                        {lessons.length === 0 && (
                            <div className="col-span-full py-20 bg-slate-900/40 border-2 border-dashed border-white/5 rounded-[3rem] text-center space-y-4">
                                <div className="text-4xl">🎬</div>
                                <h3 className="text-slate-400 font-bold">Your library is empty.</h3>
                                <p className="text-xs text-slate-600 uppercase font-black">Import a podcast or join a lesson to start learning.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
