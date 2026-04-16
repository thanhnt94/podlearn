import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Zap, Flame, Award, Lock, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const iconMap: Record<string, any> = {
  Trophy, Star, Zap, Flame, Award,
  Bird: Star,
  ShieldCheck: Award,
  Mic2: Zap,
  Clock: Trophy,
  Crown: Trophy
};

export const BadgeGrid: React.FC = () => {
    const { badges } = useAppStore();

    if (badges.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Trophy className="text-amber-500" size={24} />
                    Danh hiệu & Thành tựu
                </h2>
                <span className="px-3 py-1 bg-slate-800 text-slate-400 text-sm rounded-full border border-slate-700">
                    {badges.filter(b => b.is_earned).length} / {badges.length} đã đạt
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {badges.map((badge) => {
                    const Icon = iconMap[badge.icon_name] || Award;
                    const isEarned = badge.is_earned;

                    return (
                        <motion.div
                            key={badge.id}
                            whileHover={{ y: -5 }}
                            className={`relative group p-4 rounded-2xl border transition-all duration-300 ${
                                isEarned 
                                ? 'bg-slate-800/50 border-amber-500/30' 
                                : 'bg-slate-900/50 border-slate-800 opacity-60 grayscale'
                            }`}
                        >
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative ${
                                    isEarned 
                                    ? 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-900/20' 
                                    : 'bg-slate-800'
                                }`}>
                                    <Icon size={32} className={isEarned ? 'text-white' : 'text-slate-600'} />
                                    {isEarned && (
                                        <div className="absolute -top-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-slate-800">
                                            <CheckCircle2 size={12} />
                                        </div>
                                    )}
                                    {!isEarned && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                                            <Lock size={16} className="text-slate-500" />
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <h4 className={`text-sm font-bold ${isEarned ? 'text-white' : 'text-slate-500'}`}>
                                        {badge.name}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                        {badge.description}
                                    </p>
                                </div>
                            </div>

                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                                {isEarned ? `Đạt được vào ${new Date(badge.earned_at!).toLocaleDateString('vi-VN')}` : `Yêu cầu: ${badge.description}`}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
