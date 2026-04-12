import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, RotateCcw, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

export const ShadowingPanel: React.FC = () => {
    const { 
        subtitles, 
        activeLineIndex, 
        isRecording, 
        setRecording, 
        shadowingResult, 
        setShadowingResult,
        lessonId,
        requestSeek,
        setPlaying
    } = usePlayerStore();

    const [recordedText, setRecordedText] = useState('');
    const recognitionRef = useRef<any>(null);

    const activeLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            
            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        setRecordedText(prev => prev + event.results[i][0].transcript);
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
            };

            recognitionRef.current.onend = () => {
                setRecording(false);
            };
        }
    }, []);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            handleEvaluate();
        } else {
            setRecordedText('');
            setShadowingResult(null);
            setPlaying(false); // Pause video while recording
            recognitionRef.current?.start();
            setRecording(true);
        }
    };

    const handleEvaluate = async () => {
        if (!activeLine || !recordedText) return;

        try {
            const response = await axios.post('/api/score-pronunciation', {
                original_text: activeLine.text,
                spoken_text: recordedText,
                lesson_id: lessonId,
                start_time: activeLine.start,
                end_time: activeLine.end
            });
            setShadowingResult(response.data);
        } catch (err) {
            console.error("Evaluation failed", err);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Active Sentence Card */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500 shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500/50">Current Target</span>
                    <button 
                        onClick={() => activeLine && requestSeek(activeLine.start)}
                        className="p-2 hover:bg-sky-500/10 rounded-full text-sky-500 transition-colors"
                    >
                        <Play size={16} fill="currentColor" />
                    </button>
                </div>
                
                <h3 className="text-xl md:text-2xl font-bold leading-tight mb-2">
                    {activeLine?.text || "Select a line in transcript to start shadowing"}
                </h3>
                <p className="text-slate-500 italic text-sm">{activeLine?.trans}</p>
            </div>

            {/* Recording Area */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8 px-4">
                
                <AnimatePresence mode="wait">
                    {!shadowingResult ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-6"
                        >
                            {/* Record Button */}
                            <div className="relative">
                                {isRecording && (
                                    <motion.div 
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="absolute inset-0 bg-sky-500 rounded-full"
                                    />
                                )}
                                <button 
                                    onClick={toggleRecording}
                                    className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                                        isRecording ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-sky-500 neon-glow'
                                    }`}
                                >
                                    {isRecording ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-slate-950" />}
                                </button>
                            </div>
                            
                            <div className="text-center">
                                <p className="text-lg font-bold">
                                    {isRecording ? "Listening..." : "Click to start recording"}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {isRecording ? "Speak now clearly into your mic" : "Try to mimic the rhythm and intonation"}
                                </p>
                            </div>

                            {/* Live Text Preview */}
                            {recordedText && (
                                <div className="max-w-md p-4 bg-white/5 border border-white/5 rounded-xl text-center">
                                    <p className="text-slate-400 italic font-medium">"{recordedText}"</p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center space-y-6"
                        >
                            <div className="relative inline-block">
                                <svg className="w-32 h-32 transform -rotate-90">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                                    <motion.circle 
                                        cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                                        strokeDasharray={364.4}
                                        initial={{ strokeDashoffset: 364.4 }}
                                        animate={{ strokeDashoffset: 364.4 - (364.4 * shadowingResult.score) / 100 }}
                                        className="text-sky-500"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black">{shadowingResult.score}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold flex items-center justify-center gap-2 mb-2">
                                    {shadowingResult.score >= 80 ? <CheckCircle2 className="text-sky-500" /> : <AlertCircle className="text-yellow-500" />}
                                    {shadowingResult.score >= 80 ? "Exellent Mastery!" : "Good Try!"}
                                </h4>
                                <p className="text-sm text-slate-400">"{shadowingResult.text}"</p>
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShadowingResult(null)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <RotateCcw size={18} /> Retry
                                </button>
                                <button 
                                    onClick={() => {
                                        setShadowingResult(null);
                                        // Logic to jump to next sentence
                                    }}
                                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-sky-500/20 transition-all"
                                >
                                    Next Sentence
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
