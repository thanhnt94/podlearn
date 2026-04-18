import React, { useState } from 'react';
import { 
    Home, Compass, BookOpen, User, 
    PlusCircle, Flame, LogOut, ChevronRight, Headphones,
    Layers
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const MainSidebar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isPlayerRoute = location.pathname.includes('/player/');
    const [isHovered, setIsHovered] = useState(false);

    const isExpanded = isPlayerRoute ? isHovered : true;

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
            onMouseEnter={() => isPlayerRoute && setIsHovered(true)}
            onMouseLeave={() => isPlayerRoute && setIsHovered(false)}
            className={`hidden md:flex flex-col bg-slate-900 border-r border-white/5 h-full z-50 overflow-hidden ${
                isPlayerRoute ? 'absolute left-0 top-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]' : 'relative'
            }`}
        >
            
            {/* Brand Header */}
            <div className={`p-6 mb-4 flex items-center ${isExpanded ? 'px-8' : 'px-0 justify-center'}`}>
                <div className="flex items-center gap-4 group cursor-pointer shrink-0">
                    <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:rotate-12 transition-transform duration-500">
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
                                <h1 className="text-xl font-black tracking-tighter text-white transition-colors group-hover:text-sky-400">PodLearn</h1>
                                <div className="h-0.5 w-8 bg-sky-500 rounded-full mt-1 group-hover:w-12 transition-all" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-2 mt-4 overflow-x-hidden">
                {menuItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link 
                            key={item.id} 
                            to={item.path}
                            className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group/item relative ${
                                isActive 
                                    ? 'bg-sky-500/10 text-sky-400 font-bold' 
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                            } ${!isExpanded ? 'justify-center px-0' : ''}`}
                        >
                            <div className={`shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover/item:scale-110'}`}>
                                {item.icon}
                            </div>
                            
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.span 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="text-sm tracking-tight whitespace-nowrap"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {isActive && isExpanded && (
                                <ChevronRight size={14} className="ml-auto opacity-40" />
                            )}
                        </Link>
                    );
                })}

                <div className={`pt-8 pb-2 ${isExpanded ? 'px-4' : 'px-0 flex flex-col items-center'}`}>
                     <AnimatePresence>
                        {isExpanded ? (
                            <motion.p 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 whitespace-nowrap"
                            >
                                Quick Action
                            </motion.p>
                        ) : (
                            <div className="h-4" />
                        )}
                     </AnimatePresence>
                     
                     <button 
                        onClick={() => navigate('/import')}
                        className={`flex items-center bg-gradient-to-br from-sky-500 to-cyan-600 text-slate-950 rounded-2xl font-black transition-all active:scale-95 shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 ${
                         isExpanded ? 'w-full gap-4 px-4 py-4 text-[11px] uppercase tracking-widest' : 'w-12 h-12 justify-center p-0'
                     }`}>
                        <PlusCircle size={20} />
                        {isExpanded && <span className="whitespace-nowrap">Import New</span>}
                     </button>
                </div>
            </nav>

            {/* Footer / User Profile */}
            <div className={`p-4 border-t border-white/5 space-y-4 ${!isExpanded ? 'flex flex-col items-center' : ''}`}>
                 <div className={`bg-white/5 rounded-2xl transition-all ${isExpanded ? 'p-4 flex items-center gap-4' : 'p-2'}`}>
                     <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center font-black text-slate-950 shrink-0">
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
                                <p className="text-sm font-black text-white truncate">{(window as any).__PODLEARN_DATA__?.username || 'User'}</p>
                                <div className="flex items-center gap-1 text-sky-500">
                                    <Flame size={12} fill="currentColor" />
                                    <span className="text-[10px] font-black uppercase">Active Streak</span>
                                </div>
                            </motion.div>
                        )}
                     </AnimatePresence>
                 </div>
                 
                 <a href="/logout" className={`flex items-center gap-3 text-slate-500 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest ${
                     isExpanded ? 'px-4 py-2' : 'justify-center p-2'
                 }`}>
                     <LogOut size={16} />
                     {isExpanded && <span className="whitespace-nowrap">Sign Out</span>}
                 </a>
            </div>
        </motion.aside>
    );
};
