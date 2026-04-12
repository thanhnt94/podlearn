import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Trophy, Target, Clock, Zap, Award, Star, Medal, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const StatsView: React.FC = () => {
    const { stats, fetchDashboard, isLoading } = useAppStore();

    useEffect(() => {
        fetchDashboard();
    }, []);

    // Simple level calculation logic (placeholder for user experience)
    const totalTimeHours = Math.floor((stats?.total_time_seconds || 0) / 3600);
    const level = Math.floor(totalTimeHours / 2) + 1; // 1 level every 2 hours
    const nextLevelProgress = ((totalTimeHours % 2) / 2) * 100;

    const badges = [
        { id: 1, name: 'Night Owl', desc: 'Studied after midnight', icon: <Zap size={24} className="text-yellow-400" />, unlocked: true },
        { id: 2, name: 'Grammar King', desc: 'Completed 50 grammar sets', icon: <Star size={24} className="text-blue-400" />, unlocked: stats?.completed_count > 10 },
        { id: 3, name: 'Streak Master', desc: '7 Day streak reached', icon: <Award size={24} className="text-sky-400" />, unlocked: stats?.current_streak >= 7 },
        { id: 4, name: 'Polyglot', desc: 'Studied 3 different languages', icon: <Medal size={24} className="text-purple-400" />, unlocked: false },
    ];

    if (isLoading) return <div className="flex-1 flex items-center justify-center bg-slate-950 font-black text-slate-800 uppercase tracking-widest">Calculating Excellence...</div>;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 px-6 md:px-10 pb-24 custom-scrollbar">
            <div className="max-w-7xl mx-auto pt-12 space-y-12">
                
                {/* 1. Profile & Level Card */}
                <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                        <div className="relative">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-4xl md:text-5xl font-black">
                                {(window as any).__PODLEARN_DATA__?.username?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 md:w-12 md:h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-slate-900 font-black shadow-lg">
                                {level}
                            </div>
                        </div>

                        <div className="flex-1 space-y-6 text-center md:text-left w-full">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{(window as any).__PODLEARN_DATA__?.username || 'Learner'}</h1>
                                <p className="text-indigo-100 font-bold opacity-80 uppercase text-xs tracking-widest mt-1">Level {level} Mastery Expert</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                                    <span>Level Progress</span>
                                    <span>{Math.floor(nextLevelProgress)}%</span>
                                </div>
                                <div className="h-4 bg-black/20 rounded-full overflow-hidden border border-white/5">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${nextLevelProgress}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.6)]" 
                                    />
                                </div>
                                <p className="text-[10px] opacity-60 font-medium">Earn {2 - (totalTimeHours % 2)} more hours of study time to reach Level {level + 1}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {[
                        { label: 'Current Streak', val: stats?.current_streak || 0, sub: 'Days', icon: <Zap className="text-orange-500" />, color: 'from-orange-500/10' },
                        { label: 'Total Time', val: totalTimeHours, sub: 'Hours', icon: <Clock className="text-blue-500" />, color: 'from-blue-500/10' },
                        { label: 'Completed', val: stats?.completed_count || 0, sub: 'Lessons', icon: <Target className="text-sky-500" />, color: 'from-sky-500/10' },
                        { label: 'Longest Streak', val: stats?.longest_streak || 0, sub: 'Days', icon: <Trophy className="text-yellow-500" />, color: 'from-yellow-500/10' },
                    ].map((m, i) => (
                        <motion.div 
                            key={i}
                            whileHover={{ y: -5 }}
                            className={`p-6 md:p-8 bg-gradient-to-br ${m.color} to-slate-900 border border-white/5 rounded-[2.5rem] space-y-4`}
                        >
                            <div className="p-3 bg-white/5 w-fit rounded-2xl">{m.icon}</div>
                            <div>
                                <h3 className="text-4xl font-black text-white">{m.val}</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{m.label} ({m.sub})</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* 3. Badges Section */}
                <section className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Your Achievement Badges</h2>
                        </div>
                        <button className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors">
                            View All <ArrowUpRight size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {badges.map(badge => (
                            <div 
                                key={badge.id}
                                className={`p-8 rounded-[2.5rem] border flex flex-col items-center text-center space-y-4 transition-all duration-500 ${
                                    badge.unlocked 
                                    ? 'bg-slate-900 border-white/10 opacity-100 hover:border-purple-500/50 shadow-xl' 
                                    : 'bg-slate-950 border-dashed border-white/5 opacity-40 grayscale'
                                }`}
                            >
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${badge.unlocked ? 'bg-white/5' : 'bg-transparent'}`}>
                                    {badge.icon}
                                </div>
                                <div>
                                    <h4 className="font-black text-white tracking-tight">{badge.name}</h4>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight mt-1">{badge.desc}</p>
                                </div>
                                {!badge.unlocked && <div className="text-[9px] font-black text-slate-600 uppercase">Locked</div>}
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. Activity Chart Placeholder (Simplified Visual) */}
                <section className="p-8 md:p-12 bg-slate-900/50 border border-white/5 rounded-[3rem] space-y-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Study Activity</h2>
                        <span className="text-[10px] font-bold text-slate-500">LAST 30 DAYS</span>
                    </div>
                    
                    <div className="flex items-end justify-between h-32 px-4 gap-2">
                        {[40, 70, 45, 90, 65, 30, 85, 100, 50, 60, 20, 40].map((h, i) => (
                            <motion.div 
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: i * 0.05, duration: 1 }}
                                className={`flex-1 rounded-full transition-all duration-300 hover:scale-x-125 ${
                                    h > 80 ? 'bg-purple-500' : 'bg-slate-700 hover:bg-slate-600'
                                }`}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
