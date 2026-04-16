import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Star, Zap, Flame, Award } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const iconMap: Record<string, any> = {
  Trophy, Star, Zap, Flame, Award,
  Bird: Star, // Fallback
  ShieldCheck: Award,
  Mic2: Zap,
  Clock: Trophy,
  Crown: Trophy
};

export const AchievementModal: React.FC = () => {
    const { newlyEarnedBadge, clearCelebration } = useAppStore();

    if (!newlyEarnedBadge) return null;

    const Icon = iconMap[newlyEarnedBadge.icon_name] || Trophy;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -20 }}
                    className="relative max-w-md w-full bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-hidden"
                >
                    {/* Animated background highlights */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"
                    />
                    <motion.div 
                        animate={{ rotate: -360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl"
                    />

                    <button 
                        onClick={clearCelebration}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <motion.div
                        initial={{ rotate: -15, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.2 }}
                        className="inline-flex items-center justify-center w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                    >
                        <Icon size={48} className="text-white" />
                    </motion.div>

                    <motion.h2 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mb-2"
                    >
                        Danh hiệu Mới!
                    </motion.h2>

                    <motion.h3 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-xl font-semibold text-white mb-4"
                    >
                        {newlyEarnedBadge.name}
                    </motion.h3>

                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-slate-400 mb-8"
                    >
                        {newlyEarnedBadge.description}
                    </motion.p>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={clearCelebration}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-900/40 hover:shadow-amber-500/40 transition-shadow"
                    >
                        Tuyệt vời!
                    </motion.button>

                    {/* Fun floating particles (CSS only) */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(12)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ 
                                    opacity: [0, 1, 0],
                                    scale: [0, 1.2, 0],
                                    y: [0, -100 - Math.random() * 100],
                                    x: [0, (Math.random() - 0.5) * 200]
                                }}
                                transition={{ 
                                    duration: 2 + Math.random() * 2,
                                    repeat: Infinity,
                                    delay: Math.random() * 2
                                }}
                                className="absolute bottom-20 left-1/2 w-3 h-3 bg-amber-400 rounded-full blur-[1px]"
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
