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
    const { comments, currentTime, isCommunityOn } = usePlayerStore();
    const [bullets, setBullets] = useState<BulletComment[]>([]);
    const lastTimeRef = useRef(currentTime);
    const seenMap = useRef<Set<number | string>>(new Set());

    useEffect(() => {
        if (!isCommunityOn) {
            setBullets([]);
            seenMap.current.clear();
            return;
        }

        // Logic to trigger new bullets
        const newBullets: BulletComment[] = [];
        const timeDiff = currentTime - lastTimeRef.current;
        
        // Only trigger if we are progressing normally (not seeking long distances)
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
                        top: Math.random() * 60 + 10, // Avoid edge top/bottom (10% to 70%)
                        startTime: Date.now()
                    });
                }
            });
        }

        if (newBullets.length > 0) {
            setBullets(prev => [...prev, ...newBullets]);
        }

        // Cleanup old bullets (after 6 seconds animation)
        const now = Date.now();
        setBullets(prev => prev.filter(b => now - b.startTime < 6000));

        // If seeking backwards, clear seenMap for that region
        if (timeDiff < -0.5) {
            seenMap.current.clear();
        }

        lastTimeRef.current = currentTime;
    }, [currentTime, comments, isCommunityOn]);

    if (!isCommunityOn) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none">
            <AnimatePresence>
                {bullets.map(bullet => (
                    <motion.div
                        key={bullet.id}
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: '-150%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 6, ease: 'linear' }}
                        style={{ top: `${bullet.top}%` }}
                        className="absolute whitespace-nowrap flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full shadow-2xl"
                    >
                        <img 
                            src={bullet.avatar} 
                            alt={bullet.username} 
                            className="w-5 h-5 rounded-full border border-white/20" 
                        />
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-sky-400 uppercase leading-none mb-0.5">{bullet.username}</span>
                            <span className="text-[11px] font-bold text-white leading-none">{bullet.content}</span>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
