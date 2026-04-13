import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, RotateCcw, Play, CheckCircle2, AlertCircle, SkipForward } from 'lucide-react';
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
        requestSeek,
        setPlaying,
        isPlaying,
        isAutoNext,
        setAutoNext,
        shadowingStats,
        fetchShadowingStats,
        setMode
    } = usePlayerStore();

    const [recordedText, setRecordedText] = useState('');
    const recognitionRef = useRef<any>(null);
    const recordedTextRef = useRef('');
    const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingEvalRef = useRef(false);
    const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;

    // Stats lookup: Python backend uses str(round(float(start_time), 3))
    // which produces "12.3" not "12.300", so we match that behavior
    const statsKey = activeLine ? String(Math.round(activeLine.start * 1000) / 1000) : '';
    const currentStats = shadowingStats[statsKey] || { count: 0, avg: 0, best: 0 };

    // ─── INIT: Speech Recognition & Shadowing Mode ──────────────────
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            
            recognitionRef.current.onresult = (event: any) => {
                // Rebuild full transcript from all results
                let fullTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    fullTranscript += event.results[i][0].transcript;
                }
                recordedTextRef.current = fullTranscript;
                setRecordedText(fullTranscript);
            };

            recognitionRef.current.onend = () => {
                setRecording(false);
                // When recognition stops and we were waiting to evaluate
                if (pendingEvalRef.current) {
                    pendingEvalRef.current = false;
                    doEvaluate();
                }
            };
        }
        
        fetchShadowingStats();
        setMode('shadowing');

        return () => {
            setMode('watch');
            if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
            if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
        };
    }, []);

    // ─── CORE: Start Recording ──────────────────────────────────────
    const startRecording = useCallback(() => {
        const state = usePlayerStore.getState();
        const line = state.activeLineIndex !== -1 ? state.subtitles[state.activeLineIndex] : null;
        if (!line || !recognitionRef.current) return;
        
        // Reset
        recordedTextRef.current = '';
        setRecordedText('');
        setShadowingResult(null);
        pendingEvalRef.current = false;
        
        try {
            recognitionRef.current.start();
            setRecording(true);
        } catch (e) {
            console.warn("Speech recognition start failed", e);
            return;
        }
        
        // Auto-stop after the sentence duration + 500ms grace period
        const duration = (line.end - line.start) * 1000;
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = setTimeout(() => {
            stopRecording();
        }, duration + 500);
    }, []);
    
    // ─── CORE: Stop Recording ───────────────────────────────────────
    const stopRecording = useCallback(() => {
        if (recordingTimerRef.current) {
            clearTimeout(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        if (recognitionRef.current) {
            pendingEvalRef.current = true; // Will trigger doEvaluate in onend
            try {
                recognitionRef.current.stop();
            } catch (e) {}
        }
    }, []);

    // ─── CORE: Manual toggle (button click) ─────────────────────────
    const handleToggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            setPlaying(false);
            startRecording();
        }
    };

    // ─── CORE: Evaluate pronunciation ───────────────────────────────
    // Uses refs to avoid stale closure issues
    const doEvaluate = async () => {
        const state = usePlayerStore.getState();
        const line = state.activeLineIndex !== -1 ? state.subtitles[state.activeLineIndex] : null;
        const text = recordedTextRef.current.trim();
        
        if (!line || !text) return;

        try {
            const response = await axios.post('/api/score-pronunciation', {
                original_text: line.text,
                spoken_text: text,
                lesson_id: state.lessonId,
                start_time: line.start,
                end_time: line.end
            });
            setShadowingResult(response.data);
            fetchShadowingStats();

            // AUTO NEXT: if enabled, jump to next sentence after 2s
            if (usePlayerStore.getState().isAutoNext) {
                if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
                autoNextTimerRef.current = setTimeout(() => {
                    handleNextSentence();
                }, 2000);
            }
        } catch (err) {
            console.error("Evaluation failed", err);
        }
    };

    // ─── CORE: Navigate to next sentence ────────────────────────────
    const handleNextSentence = () => {
        const { subtitles, activeLineIndex } = usePlayerStore.getState();
        setShadowingResult(null);
        if (activeLineIndex < subtitles.length - 1) {
            const nextLine = subtitles[activeLineIndex + 1];
            requestSeek(nextLine.start, activeLineIndex + 1);
            // Small delay to let the seek complete before playing
            setTimeout(() => {
                usePlayerStore.getState().setPlaying(true);
            }, 150);
        }
    };

    // ─── AUTO TRIGGER: Start recording when video pauses at end of line ──
    useEffect(() => {
        // Conditions: video just paused, not already recording, 
        // we have an active line, and no result is showing
        if (!isPlaying && !isRecording && activeLine && !shadowingResult) {
            const { currentTime, mode } = usePlayerStore.getState();
            if (mode !== 'shadowing') return;
            
            // Did the video pause because we reached the end of the current line?
            if (currentTime >= activeLine.end - 0.2) {
                const timerId = setTimeout(() => {
                    startRecording();
                }, 300); // 300ms delay to avoid mic picking up video audio
                
                return () => clearTimeout(timerId);
            }
        }
    }, [isPlaying, isRecording, activeLineIndex, shadowingResult]);

    // ─── RENDER ──────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full gap-4">
            {/* Active Sentence Card */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500 shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500/50">Current Target</span>
                    <button 
                        onClick={() => {
                            if (activeLine) {
                                requestSeek(activeLine.start);
                                setTimeout(() => setPlaying(true), 100);
                            }
                        }}
                        className="p-2 hover:bg-sky-500/10 rounded-full text-sky-500 transition-colors"
                    >
                        <Play size={16} fill="currentColor" />
                    </button>
                </div>
                
                <h3 className="text-xl md:text-2xl font-bold leading-tight mb-2">
                    {activeLine?.text || "Chọn một dòng phụ đề hoặc bấm Play để bắt đầu"}
                </h3>
                <p className="text-slate-500 italic text-sm mb-4">{activeLine?.trans}</p>

                {/* Shadowing Stats Bar */}
                {activeLine && (
                    <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                        <div className="flex-1">
                            <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Attempts</span>
                            <span className="text-lg font-black text-white">{currentStats.count} <span className="text-xs font-normal text-slate-500 italic">lần</span></span>
                        </div>
                        <div className="flex-1 border-x border-white/5 px-4">
                            <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Avg Score</span>
                            <span className="text-lg font-black text-sky-500">{currentStats.avg}%</span>
                        </div>
                        <div className="flex-1 text-right">
                            <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Best</span>
                            <span className="text-lg font-black text-emerald-400">{currentStats.best}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <div 
                        onClick={() => setAutoNext(!isAutoNext)}
                        className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${isAutoNext ? 'bg-sky-500' : 'bg-slate-800'}`}
                    >
                        <motion.div 
                            animate={{ x: isAutoNext ? 18 : 2 }}
                            className="w-4 h-4 bg-white rounded-full absolute top-1" 
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tự chuyển câu</span>
                </div>
                {isRecording && (
                    <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Recording</span>
                    </div>
                )}
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
                                    onClick={() => handleToggleRecording()}
                                    className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                                        isRecording ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-sky-500 neon-glow'
                                    }`}
                                >
                                    {isRecording ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-slate-950" />}
                                </button>
                            </div>
                            
                            <div className="text-center">
                                <p className="text-lg font-bold">
                                    {isRecording ? "Đang nghe..." : "Bấm để thu âm hoặc chờ video tự dừng"}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {isRecording ? "Hãy nói rõ ràng vào micro" : "Bắt chước ngữ điệu và nhịp điệu của câu gốc"}
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
                                    {shadowingResult.score >= 80 ? "Xuất sắc!" : "Cố gắng thêm!"}
                                </h4>
                                <p className="text-sm text-slate-400">"{shadowingResult.spoken_text || recordedText}"</p>
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => {
                                        setShadowingResult(null);
                                        if (activeLine) {
                                            requestSeek(activeLine.start);
                                            setTimeout(() => setPlaying(true), 100);
                                        }
                                    }}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <RotateCcw size={18} /> Thử lại
                                </button>
                                <button 
                                    onClick={() => handleNextSentence()}
                                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <SkipForward size={18} /> Câu tiếp
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
