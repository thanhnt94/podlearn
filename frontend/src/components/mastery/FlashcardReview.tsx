import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Check, RotateCcw, Volume2, Sparkles, 
    ArrowRight, Trophy, Zap, ChevronLeft
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useSwipe } from '../../hooks/useSwipe';
import { soundEffects } from '../../services/SoundEffectsService';

interface Sentence {
    id: number;
    original_text: string;
    translated_text: string;
    audio_url?: string;
    mastery_level: number;
}

export const FlashcardReview: React.FC = () => {
    const { setId } = useParams<{ setId: string }>();
    const navigate = useNavigate();
    
    const [queue, setQueue] = useState<Sentence[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFinished, setIsFinished] = useState(false);
    const [direction, setDirection] = useState(0); // -1 left, 1 right

    useEffect(() => {
        const fetchQueue = async () => {
            try {
                // In a real app, this would fetch due cards for this set
                const res = await axios.get(`/api/study/sets/${setId}/review`);
                setQueue(res.data.sentences || []);
            } catch (e) {
                console.error("Failed to fetch review queue", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchQueue();
    }, [setId]);

    const handleRate = async (quality: number) => {
        const sentence = queue[currentIndex];
        if (!sentence) return;

        setDirection(quality >= 3 ? 1 : -1);
        
        if (quality >= 3) soundEffects.play('success');
        else soundEffects.play('failure');

        try {
            await axios.post(`/api/study/sentences/${sentence.id}/review`, { quality });
        } catch (e) {
            console.error("Failed to submit review", e);
        }

        // Animation delay
        setTimeout(() => {
            if (currentIndex < queue.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setIsFlipped(false);
                setDirection(0);
            } else {
                setIsFinished(true);
            }
        }, 300);
    };

    const swipeHandlers = useSwipe({
        onSwipeLeft: () => isFlipped && handleRate(1), // Forgot
        onSwipeRight: () => isFlipped && handleRate(5), // Perfect
        onSwipeUp: () => setIsFlipped(true),
        threshold: 50
    });

    const playAudio = () => {
        const audioUrl = queue[currentIndex]?.audio_url;
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play();
        }
    };

    if (isLoading) return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 border-4 border-sky-500/10 border-t-sky-500 rounded-full animate-spin" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Preparing your session</span>
        </div>
    );

    if (isFinished) return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center space-y-10">
            <motion.div 
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]"
            >
                <Trophy size={60} />
            </motion.div>
            <div className="space-y-2">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Session Complete!</h2>
                <p className="text-slate-400 font-bold">You reviewed {queue.length} sentences today.</p>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
                <button 
                    onClick={() => navigate('/sets')}
                    className="w-full py-4 bg-sky-500 text-slate-950 font-black rounded-2xl hover:bg-sky-400 transition-all shadow-xl shadow-sky-500/20 uppercase tracking-widest text-xs"
                >
                    Back to Library
                </button>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-white/5 text-white font-black rounded-2xl hover:bg-white/10 transition-all border border-white/5 uppercase tracking-widest text-xs"
                >
                    Review Again
                </button>
            </div>
        </div>
    );

    const currentCard = queue[currentIndex];

    return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden font-inter text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl shrink-0">
                <button onClick={() => navigate('/sets')} className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-xl">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Mastery Review</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-black text-white">{currentIndex + 1}</span>
                        <span className="text-[10px] text-slate-700">/</span>
                        <span className="text-[10px] text-slate-600 font-bold">{queue.length}</span>
                    </div>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                    <Zap size={18} fill="currentColor" />
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full bg-white/5">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
                    className="h-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                />
            </div>

            {/* Card Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative" {...swipeHandlers}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ x: direction * 300, opacity: 0, rotateY: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: direction * -300, opacity: 0 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                        className="w-full max-w-md aspect-[3/4] relative perspective-1000 group"
                        onClick={() => {
                            setIsFlipped(!isFlipped);
                            soundEffects.play('pop');
                        }}
                    >
                        <motion.div 
                            className="w-full h-full relative preserve-3d transition-transform duration-500 cursor-pointer"
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                        >
                            {/* Front: Question */}
                            <div className="absolute inset-0 backface-hidden bg-slate-900 border border-white/10 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent opacity-50" />
                                <div className="mb-8 p-4 bg-sky-500/10 rounded-full text-sky-400">
                                    <Sparkles size={32} />
                                </div>
                                <h3 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
                                    {currentCard?.original_text}
                                </h3>
                                <div className="mt-12 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] animate-pulse">Tap to reveal</div>
                            </div>

                            {/* Back: Answer */}
                            <div className="absolute inset-0 backface-hidden bg-slate-800 border border-sky-500/20 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-2xl rotateY-180 overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50" />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); playAudio(); }}
                                    className="mb-8 p-5 bg-white text-slate-950 rounded-full hover:scale-110 transition-all shadow-xl"
                                >
                                    <Volume2 size={32} fill="currentColor" />
                                </button>
                                <div className="space-y-4">
                                    <p className="text-sm font-bold text-sky-400 uppercase tracking-widest">Translation</p>
                                    <h3 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight">
                                        {currentCard?.translated_text}
                                    </h3>
                                </div>
                                <div className="mt-12 flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mastery:</span>
                                    <div className="flex gap-1">
                                        {[1,2,3,4,5].map(lv => (
                                            <div key={lv} className={`w-2 h-2 rounded-full ${lv <= currentCard.mastery_level ? 'bg-amber-500' : 'bg-slate-700'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Controls */}
            <div className="p-8 border-t border-white/5 bg-slate-900/50 backdrop-blur-xl shrink-0">
                <div className="max-w-md mx-auto">
                    {!isFlipped ? (
                        <button 
                            onClick={() => setIsFlipped(true)}
                            className="w-full py-5 bg-white text-slate-950 font-black rounded-[2rem] hover:bg-slate-100 transition-all shadow-xl uppercase tracking-widest text-sm flex items-center justify-center gap-3"
                        >
                            Reveal Answer <ArrowRight size={18} />
                        </button>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => handleRate(1)}
                                className="flex flex-col items-center gap-2 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[2rem] border border-red-500/20 transition-all group"
                            >
                                <RotateCcw size={20} className="group-hover:rotate-[-45deg] transition-transform" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Forgot</span>
                            </button>
                            <button 
                                onClick={() => handleRate(5)}
                                className="flex flex-col items-center gap-2 py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-[2rem] border border-emerald-500/20 transition-all group"
                            >
                                <Check size={20} className="group-hover:scale-125 transition-transform" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Mastered</span>
                            </button>
                        </div>
                    )}
                    <p className="text-center mt-6 text-[9px] font-bold text-slate-600 uppercase tracking-widest opacity-50">Swipe left to fail • Swipe right to master</p>
                </div>
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotateY-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};
