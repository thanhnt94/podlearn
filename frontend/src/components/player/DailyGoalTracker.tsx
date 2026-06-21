import React from 'react';
import { motion } from 'framer-motion';
import { Target, Flame } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const DailyGoalTracker: React.FC = () => {
    const { sessionListeningSeconds, initialListeningSeconds } = usePlayerStore();
    
    // Total seconds for today
    const totalSeconds = initialListeningSeconds + sessionListeningSeconds;
    const goalSeconds = 15 * 60; // 15 minutes
    
    const progressPercent = Math.min(100, Math.max(0, (totalSeconds / goalSeconds) * 100));
    const isGoalReached = totalSeconds >= goalSeconds;
    
    // Format mm:ss
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="hidden md:flex items-center gap-3 bg-slate-900/80 border border-white/5 rounded-full px-3 py-1.5 backdrop-blur-md">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full ${isGoalReached ? 'bg-amber-500/20 text-amber-500' : 'bg-sky-500/20 text-sky-400'}`}>
                {isGoalReached ? <Flame size={14} /> : <Target size={14} />}
            </div>
            
            <div className="flex flex-col min-w-[80px]">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Daily Goal</span>
                    <span className={`text-[10px] font-bold ${isGoalReached ? 'text-amber-500' : 'text-sky-400'}`}>
                        {formatTime(totalSeconds)} / 15:00
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={`h-full rounded-full ${isGoalReached ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-sky-500'}`}
                    />
                </div>
            </div>
        </div>
    );
};
