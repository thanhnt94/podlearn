import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Star, Sparkles, Award } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const iconMap: Record<string, any> = {
  Award, Trophy, Star, Sparkles
};

export const AchievementModal: React.FC = () => {
    const { newlyEarnedBadge, clearCelebration } = useAppStore();

    if (!newlyEarnedBadge) return null;

    const Icon = iconMap[newlyEarnedBadge.icon_name] || Award;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                {/* Backdrop with extreme blur and dark tint */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={clearCelebration}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl"
                />

                {/* Modal Container */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 40 }}
                    className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden"
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />
                    <div className="absolute top-[-50px] left-[50%] -translate-x-1/2 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="p-10 flex flex-col items-center text-center space-y-8 relative z-10">
                        {/* Close Button */}
                        <button onClick={clearCelebration} className="absolute top-6 right-8 p-2 text-slate-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>

                        {/* Animated Badge Icon Container */}
                        <div className="relative mt-4">
                            <motion.div 
                                initial={{ rotate: -15, scale: 0.5 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                                className="w-32 h-32 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-sky-500/40 border-4 border-white/20 relative z-20"
                            >
                                <Icon size={64} className="text-slate-950" fill="currentColor" />
                            </motion.div>
                            
                            {/* Orbiting Stars/Particles */}
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-[-40px] border border-dashed border-white/10 rounded-full pointer-events-none"
                            />
                            {[0, 72, 144, 216, 288].map((deg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                                    style={{ transform: `rotate(${deg}deg) translateY(-80px)` }}
                                    className="absolute top-1/2 left-1/2 text-sky-400"
                                >
                                    <Star size={16} fill="currentColor" />
                                </motion.div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <motion.p 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-[10px] font-black text-sky-400 uppercase tracking-[0.5em]"
                                >
                                    Mission Accomplished
                                </motion.p>
                                <motion.h2 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-4xl font-black text-white tracking-tighter"
                                >
                                    {newlyEarnedBadge.name}
                                </motion.h2>
                            </div>
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-slate-400 font-medium leading-relaxed max-w-xs mx-auto"
                            >
                                {newlyEarnedBadge.description}
                            </motion.p>
                        </div>

                        <motion.button 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={clearCelebration}
                            className="w-full py-5 bg-white text-slate-950 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-white/5 active:scale-95"
                        >
                            Claim Achievement
                        </motion.button>
                        
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                            Synched to Mastery Profile
                        </p>
                    </div>

                    {/* Fun floating particles */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(12)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ 
                                    opacity: [0, 1, 0],
                                    scale: [0, 1.2, 0],
                                    y: [0, -200 - Math.random() * 200],
                                    x: [0, (Math.random() - 0.5) * 300]
                                }}
                                transition={{ 
                                    duration: 3 + Math.random() * 2,
                                    repeat: Infinity,
                                    delay: Math.random() * 2
                                }}
                                className="absolute bottom-20 left-1/2 w-2 h-2 bg-sky-400/30 rounded-full blur-[2px]"
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
