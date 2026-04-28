import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';

interface BulletComment {
    id: number | string;
    content: string;
    avatar: string;
    username: string;
    role: string;
    top: number; // Vertical position in percent
    startTime: number;
    speed: number;
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
                    
                    // Simple Lane Selection (Collision Avoidance)
                    const now = Date.now();
                    let selectedLane = 0;
                    let minTime = Infinity;
                    
                    for (let i = 0; i < 10; i++) {
                        const lastTime = (window as any)[`__lane_${i}`] || 0;
                        if (lastTime < now) {
                            selectedLane = i;
                            break;
                        }
                        if (lastTime < minTime) {
                            minTime = lastTime;
                            selectedLane = i;
                        }
                    }
                    (window as any)[`__lane_${selectedLane}`] = now + 4000; // Block lane for 4s

                    newBullets.push({
                        id: c.id,
                        content: c.content,
                        avatar: c.user.avatar_url,
                        username: c.user.username,
                        role: c.user.role || 'free',
                        top: 10 + (selectedLane * 8),
                        startTime: now,
                        speed: 8 + Math.random() * 8 // Random speed between 8-16s
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
                        initial={mode === 'danmaku' ? { x: '100vw', opacity: 1 } : { y: -20, opacity: 0, x: '-50%' }}
                        animate={mode === 'danmaku' ? { x: '-150vw' } : { y: 20, opacity: 1, x: '-50%' }}
                        exit={{ opacity: 0 }}
                        transition={mode === 'danmaku' ? { duration: bullet.speed, ease: 'linear' } : { duration: 0.5 }}
                        style={{ 
                            top: mode === 'danmaku' ? `${bullet.top}%` : '5%',
                            left: mode === 'fixed' ? '50%' : 'auto',
                            opacity: opacity
                        }}
                        className={`absolute whitespace-nowrap flex items-center gap-3 bg-slate-950/90 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-all ${
                            bullet.role === 'admin' ? 'ring-2 ring-rose-500/50 shadow-rose-500/20' : 
                            bullet.role === 'vip' ? 'ring-2 ring-amber-500/50 shadow-amber-500/20' : ''
                        } ${
                            mode === 'danmaku' ? 'px-4 py-2' : 'px-6 py-3 border-b-sky-500 border-b-2'
                        }`}
                    >
                        <img 
                            src={bullet.avatar} 
                            alt={bullet.username} 
                            className="w-8 h-8 rounded-full border border-white/30 object-cover shadow-sm" 
                        />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-black text-sky-400 uppercase tracking-wider leading-none">{bullet.username}</span>
                                {bullet.role === 'admin' && <span className="bg-rose-500 text-white text-[7px] px-1 rounded font-black uppercase tracking-tighter">Staff</span>}
                                {bullet.role === 'vip' && <span className="bg-amber-500 text-slate-950 text-[7px] px-1 rounded font-black uppercase tracking-tighter">VIP</span>}
                            </div>
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
