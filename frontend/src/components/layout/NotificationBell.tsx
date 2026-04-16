import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Trophy, Flame, User } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const NotificationBell: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, markNotificationRead } = useAppStore();
    const bellRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'ACHIEVEMENT': return <Trophy className="text-amber-500" size={16} />;
            case 'STREAK_REMINDER': return <Flame className="text-orange-500" size={16} />;
            case 'SHARE_INVITE': return <User className="text-cyan-500" size={16} />;
            default: return <Bell className="text-slate-400" size={16} />;
        }
    };

    return (
        <div className="relative" ref={bellRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-all duration-300 ${
                    isOpen ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[10px] font-bold text-white leading-none">
                            {unreadCount}
                        </span>
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right"
                    >
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-white">Thông báo</h3>
                            {unreadCount > 0 && (
                                <span className="text-xs text-amber-500 font-medium">{unreadCount} mới</span>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell size={40} className="mx-auto text-slate-800 mb-3" />
                                    <p className="text-slate-500 text-sm">Chưa có thông báo nào</p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div 
                                        key={n.id}
                                        onClick={() => markNotificationRead(n.id)}
                                        className={`group p-4 flex gap-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors cursor-pointer ${
                                            !n.is_read ? 'bg-amber-500/5' : ''
                                        }`}
                                    >
                                        <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                                            !n.is_read ? 'bg-amber-500/10' : 'bg-slate-800'
                                        }`}>
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className={`text-sm font-semibold truncate ${!n.is_read ? 'text-white' : 'text-slate-400'}`}>
                                                    {n.title}
                                                </h4>
                                                {!n.is_read && (
                                                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                {n.message}
                                            </p>
                                            <span className="text-[10px] text-slate-600 block pt-1">
                                                {new Date(n.created_at).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-3 bg-slate-800/50 text-center">
                                <button className="text-xs text-slate-400 hover:text-white transition-colors">
                                    Xem tất cả
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
