import React, { useState } from 'react';
import { 
    Home, Compass, BookOpen, User, 
    PlusCircle, Flame, LogOut, Headphones,
    Layers
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const MainSidebar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', path: '/', icon: <Home size={22} /> },
        { id: 'sets', label: 'Library Sets', path: '/sets', icon: <Layers size={22} /> },
        { id: 'mastery', label: 'Mastery', path: '/mastery', icon: <BookOpen size={22} /> },
        { id: 'explore', label: 'Explore', path: '/explore', icon: <Compass size={22} /> },
        { id: 'profile', label: 'My Stats', path: '/profile', icon: <User size={22} /> },
    ];

    return (
        <motion.aside 
            initial={false}
            animate={{ width: isExpanded ? 280 : 80 }}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            className="hidden md:flex flex-col bg-slate-900 border-r border-white/5 h-full absolute left-0 top-0 z-50 shadow-[20px_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
        >
            
            {/* Brand Header */}
            <Link to="/" className={`p-6 mb-4 flex items-center transition-all ${isExpanded ? 'px-8' : 'px-0 justify-center'} hover:opacity-80`}>
                <div className="flex items-center gap-4 group cursor-pointer shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:rotate-12 transition-transform duration-500 border border-white/10">
                        <Headphones size={24} className="text-slate-950" fill="currentColor" />
                    </div>
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="whitespace-nowrap"
                            >
                                <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-sky-400 transition-all group-hover:to-sky-300">
                                    PodLearn
                                </h1>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className="h-1 w-8 bg-sky-500 rounded-full group-hover:w-16 transition-all duration-500" />
                                    <div className="h-1 w-1 bg-sky-500 rounded-full animate-pulse" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Link>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1.5 mt-8 overflow-x-hidden">
                {menuItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link 
                            key={item.id} 
                            to={item.path}
                            className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group/item relative ${
                                isActive 
                                    ? 'text-sky-400 font-black' 
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                            } ${!isExpanded ? 'justify-center px-0' : ''}`}
                        >
                            {/* Animated Active Indicator */}
                            {isActive && (
                                <motion.div 
                                    layoutId="active-nav"
                                    className="absolute inset-0 bg-sky-500/10 border border-sky-500/20 rounded-2xl z-0"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}

                            <div className={`relative z-10 shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover/item:scale-110'}`}>
                                {item.icon}
                            </div>
                            
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.span 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="relative z-10 text-[11px] font-black uppercase tracking-widest whitespace-nowrap"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {isActive && isExpanded && (
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="ml-auto relative z-10"
                                >
                                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                                </motion.div>
                            )}
                        </Link>
                    );
                })}

                <div className={`pt-10 pb-2 ${isExpanded ? 'px-4' : 'px-0 flex flex-col items-center'}`}>
                     <AnimatePresence>
                        {isExpanded && (
                            <motion.p 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 whitespace-nowrap"
                            >
                                Creation Studio
                            </motion.p>
                        )}
                     </AnimatePresence>
                     
                     <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/import')}
                        className={`flex items-center bg-gradient-to-br from-sky-400 to-indigo-500 text-slate-950 rounded-2xl font-black transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/30 ${
                         isExpanded ? 'w-full gap-4 px-6 py-4 text-[10px] uppercase tracking-widest' : 'w-12 h-12 justify-center p-0'
                     }`}>
                        <PlusCircle size={20} strokeWidth={3} />
                        {isExpanded && <span className="whitespace-nowrap">New Project</span>}
                     </motion.button>
                </div>
            </nav>

            {/* Footer / User Profile */}
            <div className={`p-4 border-t border-white/5 space-y-4 ${!isExpanded ? 'flex flex-col items-center' : ''}`}>
                 <div className={`bg-white/5 rounded-2xl transition-all border border-white/5 ${isExpanded ? 'p-4 flex items-center gap-4' : 'p-2'}`}>
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center font-black text-sky-400 shrink-0 border border-white/10">
                         {(window as any).__PODLEARN_DATA__?.username?.[0].toUpperCase() || 'U'}
                     </div>
                     <AnimatePresence>
                        {isExpanded && (
                            <motion.div 
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="flex-1 overflow-hidden"
                            >
                                <p className="text-xs font-black text-white truncate">{(window as any).__PODLEARN_DATA__?.username || 'User'}</p>
                                <div className="flex items-center gap-1.5 text-orange-500">
                                    <Flame size={12} fill="currentColor" />
                                    <span className="text-[9px] font-black uppercase tracking-tight">Daily Streak</span>
                                </div>
                            </motion.div>
                        )}
                     </AnimatePresence>
                 </div>
                 
                 <a href="/logout" className={`flex items-center gap-3 text-slate-600 hover:text-red-400 transition-colors text-[10px] font-black uppercase tracking-widest ${
                     isExpanded ? 'px-6 py-2' : 'justify-center p-2'
                 }`}>
                     <LogOut size={16} />
                     {isExpanded && <span className="whitespace-nowrap">Log Out</span>}
                 </a>
            </div>
        </motion.aside>
    );
};
