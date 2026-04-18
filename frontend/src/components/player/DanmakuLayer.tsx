import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';

interface BulletComment {
    id: number | string;
    content: string;
    avatar: string;
    username: string;
    top: number; // Vertical position in percent
    startTime: number;
}

export const DanmakuLayer: React.FC = () => {
    const { comments, currentTime, settings } = usePlayerStore();
    const { enabled, mode, fontSize, opacity } = settings.community;
    
    const [bullets, setBullets] = useState<BulletComment[]>([]);
    const lastTimeRef = useRef(currentTime);
    const seenMap = useRef<Set<number | string>>(new Set());

    useEffect(() => {
        if (!enabled) {
            setBullets([]);
            seenMap.current.clear();
            return;
        }

        const newBullets: BulletComment[] = [];
        const timeDiff = currentTime - lastTimeRef.current;
        
        if (timeDiff > 0 && timeDiff < 2) {
            comments.forEach(c => {
                if (c.video_timestamp !== null && 
                    c.video_timestamp >= lastTimeRef.current && 
                    c.video_timestamp < currentTime && 
                    !seenMap.current.has(c.id)) {
                    
                    seenMap.current.add(c.id);
                    newBullets.push({
                        id: c.id,
                        content: c.content,
                        avatar: c.user.avatar_url,
                        username: c.user.username,
                        top: Math.random() * 60 + 10,
                        startTime: Date.now()
                    });
                }
            });
        }

        if (newBullets.length > 0) {
            if (mode === 'fixed') {
                // In fixed mode, only keep the latest comment
                setBullets([newBullets[newBullets.length - 1]]);
            } else {
                setBullets(prev => [...prev, ...newBullets]);
            }
        }

        if (mode === 'danmaku') {
            const now = Date.now();
            setBullets(prev => prev.filter(b => now - b.startTime < 12000));
        } else if (mode === 'fixed') {
            const now = Date.now();
            setBullets(prev => prev.filter(b => now - b.startTime < 5000));
        }

        if (timeDiff < -0.5) seenMap.current.clear();
        lastTimeRef.current = currentTime;
    }, [currentTime, comments, enabled, mode]);

    if (!enabled) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none">
            <AnimatePresence mode="popLayout">
                {bullets.map(bullet => (
                    <motion.div
                        key={bullet.id}
                        initial={mode === 'danmaku' ? { x: '-50vw', opacity: 1 } : { y: -20, opacity: 0, x: '-50%' }}
                        animate={mode === 'danmaku' ? { x: '110vw' } : { y: 20, opacity: 1, x: '-50%' }}
                        exit={{ opacity: 0 }}
                        transition={mode === 'danmaku' ? { duration: 12, ease: 'linear' } : { duration: 0.5 }}
                        style={{ 
                            top: mode === 'danmaku' ? `${bullet.top}%` : '5%',
                            left: mode === 'fixed' ? '50%' : 'auto',
                            opacity: opacity
                        }}
                        className={`absolute whitespace-nowrap flex items-center gap-3 bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.6)] ${
                            mode === 'danmaku' ? 'px-4 py-2 border-l-sky-500 border-l-4' : 'px-6 py-3 border-b-emerald-500 border-b-2'
                        }`}
                    >
                        <img 
                            src={bullet.avatar} 
                            alt={bullet.username} 
                            className="w-8 h-8 rounded-full border border-white/30 object-cover shadow-sm" 
                        />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-sky-400 uppercase tracking-wider leading-none mb-1">{bullet.username}</span>
                            <span 
                                className="font-bold text-white leading-none tracking-tight"
                                style={{ fontSize: `${fontSize}rem` }}
                            >
                                {bullet.content}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
