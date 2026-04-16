import React from 'react';
import { Home, Lightbulb, Compass, Layers } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export const BottomNav: React.FC = () => {
    const location = useLocation();

    const tabs = [
        { id: 'dashboard', label: 'Home', path: '/', icon: <Home size={22} /> },
        { id: 'sets', label: 'Sets', path: '/sets', icon: <Layers size={22} /> },
        { id: 'mastery', label: 'Learn', path: '/mastery', icon: <Lightbulb size={22} /> },
        { id: 'explore', label: 'Discovery', path: '/explore', icon: <Compass size={22} /> },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 pb-safe-area">
            <div className="flex items-center justify-around h-20 px-4">
                {tabs.map(tab => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <Link 
                            key={tab.id} 
                            to={tab.path}
                            className={`relative flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-all duration-300 ${
                                isActive ? 'text-sky-400' : 'text-slate-500'
                            }`}
                        >
                            <div className={`transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-1' : 'scale-100'}`}>
                                {tab.icon}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                            
                            {isActive && (
                                <motion.div 
                                    layoutId="activeTabGlowMobile"
                                    className="absolute -top-[1px] w-10 h-[2px] bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.8)]" 
                                />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
