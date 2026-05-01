import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Check, Trash2, Mail } from 'lucide-react';
import axios from 'axios';
import { useAppStore } from '../../store/useAppStore';

interface InviteManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    invites: any[];
}

export const InviteManagerModal: React.FC<InviteManagerModalProps> = ({ isOpen, onClose, invites }) => {
    const { fetchDashboard } = useAppStore();

    const handleAction = async (id: number, action: 'accept' | 'reject') => {
        try {
            await axios.post(`/api/shares/${id}/${action}`, {});
            await fetchDashboard();
            if (invites.length <= 1) onClose();
        } catch (err) {
            console.error("Failed to handle invite", err);
            alert("Failed to process request.");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                    />
                    
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-indigo-400">
                                    <Mail size={24} />
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Workspace Invites</h2>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {(invites || []).map(invite => (
                                    <div key={invite.id} className="bg-slate-950/50 border border-white/5 p-5 rounded-3xl space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                                                <UserPlus size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-slate-300 font-medium">
                                                    <span className="text-white font-black">{invite.sender_name}</span> wants to share a workspace:
                                                </p>
                                                <h3 className="text-white font-bold truncate mt-0.5">{invite.video_title}</h3>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-2">
                                                    Received {new Date(invite.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleAction(invite.id, 'accept')}
                                                className="flex-1 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Check size={14} /> Accept
                                            </button>
                                            <button 
                                                onClick={() => handleAction(invite.id, 'reject')}
                                                className="px-4 py-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
                                                title="Decline"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {invites.length === 0 && (
                                    <div className="text-center py-12 space-y-3">
                                        <div className="text-4xl opacity-20">📭</div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No pending invites</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
