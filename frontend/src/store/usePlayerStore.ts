import { create } from 'zustand';
import axios from 'axios';
import { useAppStore } from './useAppStore';

interface SubtitleLine {
  start: number;
  end: number;
  text: string;
  trans?: string;
  [key: string]: any;
}

interface TrackSettings {
  fontSize: number;
  color: string;
  bgColor: string;
  bgOpacity: number;
  enabled: boolean;
  position: number; // Vertical offset from bottom (0-100)
  textAlign: 'left' | 'center' | 'right';
}

interface Note {
  id: number;
  timestamp: number;
  content: string;
  created_at?: string;
}

interface PlayerState {
  // Playback
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isLockedPaused: boolean; 
  
  // Content
  lessonId: number | null;
  lessonTitle: string | null;
  videoId: string | null;
  originalLang: string;
  subtitles: SubtitleLine[];
  s1Lines: SubtitleLine[];
  s2Lines: SubtitleLine[];
  s3Lines: SubtitleLine[];
  notes: Note[];
  activeLineIndex: number;
  isVocabStudioOpen: boolean;
  setVocabStudioOpen: (open: boolean) => void;
  
  // UI / Interaction
  mode: 'watch' | 'shadowing' | 'loop';
  isLoaded: boolean;
  isCompleted: boolean;
  isLocked: boolean; 
  lockMessage: string | null;
  sidebarWidth: number;
  seekToTime: number | null;
  isRecording: boolean;
  shadowingResult: any | null;
  
  availableTracks: any[];
  trackMetadata: {
    s1: any;
    s2: any;
    s3: any;
  };
  
  fetchAvailableTracks: () => Promise<void>;
  translateTrack: (trackId: number, targetLang: string, name: string) => Promise<void>;
  exportTrack: (trackId: number, format: 'srt' | 'vtt') => Promise<void>;
  updateTrackName: (trackId: number, name: string) => Promise<void>;
  trackIds: {
    s1: number | string | null;
    s2: number | string | null;
    s3: number | string | null;
    ai: number | null;
  };
  aiInsights: any[];
  aiStatus: string;
  aiProgress: {
    processed: number;
    total: number;
  };
  ttsBatchProgress: { done: number; total: number; cached: number };
  ttsBatchTaskId: string | null;
  ttsTrackSource: 's1' | 's2' | 's3';
  handsFreeModeEnabled: boolean;
  handsFreeType: 'original' | 'mixed';
  handsFreeStatus: 'idle' | 'playing_original' | 'playing_tts' | 'transitioning' | 'generating';
  handsFreeAudioUrl: string | null;
  handsFreeOriginalUrl: string | null;
  handsFreeTimeline: any[] | null;
  handsFreeTaskId: string | null;
  handsFreeProgress: number;
  handsFreeDuration: number;
  handsFreeStep: string;
  ttsAudioCache: Record<number, string>;
  aiSummary: string | null;
  isAutoNext: boolean;
  shadowingStats: Record<string, { count: number, avg: number, best: number }>;

  abLoop: {
    start: number | null;
    end: number | null;
    enabled: boolean;
  };
  lastSeekTime: number;
  subtitleWorker: Worker | null;
  isSeeking: boolean; 
  
  curatedContent: {
    overview: string;
    grammar: string;
    vocabulary: string;
  };
  fetchCuratedContent: () => Promise<void>;
  updateCuratedContent: (data: Partial<PlayerState['curatedContent']>) => Promise<void>;
  
  isNativeCCOn: boolean; 
  nativeCCLang: string;
  comments: any[];
  
  // Gamification Tracking
  initialListeningSeconds: number;
  sessionListeningSeconds: number;
  sessionShadowingCount: number;
  sessionShadowingSeconds: number;
  
  analyzedWords: { 
    surface: string, 
    original: string,
    reading: string | null, 
    furigana?: string | null,
    meanings?: string[],
    pos?: string, 
    lemma?: string 
  }[];
  showFurigana: boolean;
  lastAnalyzedIndex: number;
  hasTokens: boolean;
  isManualAnalysis: boolean;
  
  settings: {
      s1: TrackSettings;
      s2: TrackSettings;
      s3: TrackSettings;
      notes: {
        enabled: boolean;
        beforeSecs: number;
        duration: number;
        position: number;
        alignment: 'topLeft' | 'topCenter' | 'topRight' | 'centerLeft' | 'center' | 'centerRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight';
        theme: 'classic' | 'cyber' | 'amber' | 'ghost';
        fontSize: number;
      };
      community: {
        enabled: boolean;
        mode: 'danmaku' | 'fixed';
        fontSize: number;
        opacity: number;
      };
      syncOffset: number;
  };
  
  // Actions
  setCurrentTime: (time: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setLockedPaused: (isLocked: boolean) => void; 
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setLessonData: (data: any) => void;
  setPlaybackRate: (rate: number) => void;
  requestSeek: (time: number, newIndex?: number) => void;
  setRecording: (isRecording: boolean) => void;
  setShadowingResult: (result: any) => void;
  setSeeking: (isSeeking: boolean) => void;
  toggleNativeCC: () => void;
  setNativeCCLang: (lang: string) => void;
  toggleCommunity: () => void;
  setCommunitySettings: (settings: Partial<PlayerState['settings']['community']>) => void;
  fetchComments: (videoId: string | number) => Promise<void>;
  addComment: (videoId: string | number, content: string, timestamp?: number) => Promise<void>;
  
  addListeningTime: (seconds: number) => void;
  addShadowingCount: (count: number, durationSeconds: number) => void;
  flushTrackingData: () => Promise<void>;

  setTrackSettings: (track: 's1' | 's2' | 's3', settings: Partial<TrackSettings>) => void;
  setAvailableTracks: (tracks: any[]) => void;
  setTrackIds: (ids: Partial<PlayerState['trackIds']>) => void;
  setAbLoop: (loop: Partial<PlayerState['abLoop']>) => void;
  setNotes: (notes: Note[]) => void;
  setNoteSettings: (settings: Partial<PlayerState['settings']['notes']>) => void;
  setSyncOffset: (offset: number) => void;
  addNote: (note: Note) => void;
  deleteNote: (id: number) => void;
  updateNote: (id: number, content: string) => void;
  fetchLessonData: (id: number) => Promise<void>;
  completeLesson: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  fetchShadowingStats: () => Promise<void>;
  setAutoNext: (isAutoNext: boolean) => void;
  setMode: (mode: 'watch' | 'shadowing' | 'loop') => void;
  setSidebarWidth: (width: number) => void;
  setAIInsights: (data: any) => void;
  fetchAIInsights: () => Promise<void>;
  analyzeLine: (index: number) => Promise<void>;
  
  setAnalyzedWords: (words: any[]) => void;
  toggleFurigana: () => void;
  fetchAnalyzedWords: (text: string, lang: string) => Promise<void>;
  checkScanStatus: (id?: number) => Promise<void>;
  scanFullLesson: (priority: string) => Promise<void>;
  
  saveSettings: () => Promise<void>;
  saveAsDefaultPreferences: () => Promise<void>;
  skipNextSentence: () => void;
  skipPrevSentence: () => void;
  updateSubtitleLine: (trackKey: 's1' | 's2' | 's3', index: number, data: Partial<SubtitleLine>) => Promise<void>;
  splitSubtitleLine: (track: 's1' | 's2' | 's3', index: number, time: number) => Promise<void>;
  mergeSubtitleLine: (track: 's1' | 's2' | 's3', index: number) => Promise<void>;
  deleteSubtitleLine: (track: 's1' | 's2' | 's3', index: number) => Promise<void>;
  shiftSubtitleTrack: (trackKey: 's1' | 's2' | 's3', offsetMs: number) => void;
  saveTrackShifts: (trackKey: 's1' | 's2' | 's3', totalOffsetMs: number) => Promise<void>;

  // Hands-Free Actions
  toggleHandsFreeMode: () => void;
  setHandsFreeModeEnabled: (enabled: boolean) => void;
  setHandsFreeType: (type: 'original' | 'mixed') => void;
  setHandsFreeStatus: (status: PlayerState['handsFreeStatus']) => void;
  setHandsFreeAudioData: (audioUrl: string | null, timeline: any[] | null, duration: number) => void;
  setHandsFreeOriginalData: (audioUrl: string | null, duration: number) => void;
  setHandsFreeTaskId: (id: string | null) => void;
  setHandsFreeProgress: (progress: number, step: string) => void;
  setTTSTrackSource: (source: 's1' | 's2' | 's3') => void;
  generateHandsFreeMixed: () => void;
}

const defaultTrackSettings = (fontSize: number, color: string, opacity: number, position: number): TrackSettings => ({
    fontSize, color, bgColor: '#000000', bgOpacity: opacity, enabled: true, position, textAlign: 'center'
});

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  volume: 100,
  isLockedPaused: false,
  lastSeekTime: 0,
  subtitleWorker: null,
  isSeeking: false,

  curatedContent: { overview: '', grammar: '', vocabulary: '' },
  fetchCuratedContent: async () => {
    const { videoId } = get();
    if (!videoId) return;
    try {
        const res = await axios.get(`/api/content/curated/${videoId}`);
        set({ curatedContent: res.data });
    } catch (e) {}
  },
  updateCuratedContent: async (data) => {
    const { videoId, curatedContent } = get();
    if (!videoId) return;
    try {
        await axios.patch(`/api/content/curated/${videoId}`, data);
        set({ curatedContent: { ...curatedContent, ...data } });
    } catch (e) { throw e; }
  },

  isNativeCCOn: false,
  nativeCCLang: 'ja',
  comments: [],
  handsFreeModeEnabled: false,
  handsFreeType: 'original',
  handsFreeStatus: 'idle',
  handsFreeAudioUrl: null,
  handsFreeOriginalUrl: null,
  handsFreeTimeline: null,
  handsFreeTaskId: null,
  handsFreeProgress: 0,
  handsFreeDuration: 0,
  handsFreeStep: '',
  ttsAudioCache: {},
  ttsBatchProgress: { done: 0, total: 0, cached: 0 },
  ttsBatchTaskId: null,
  ttsTrackSource: 's2',
  initialListeningSeconds: 0,
  sessionListeningSeconds: 0,
  sessionShadowingCount: 0,
  sessionShadowingSeconds: 0,
  analyzedWords: [],
  showFurigana: true,
  lastAnalyzedIndex: -1,
  hasTokens: false,
  isManualAnalysis: false,
  isVocabStudioOpen: false,
  setVocabStudioOpen: (open) => set({ isVocabStudioOpen: open }),
  lessonId: null,
  lessonTitle: null,
  videoId: null,
  originalLang: 'ja',
  subtitles: [],
  s1Lines: [],
  s2Lines: [],
  s3Lines: [],
  notes: [],
  activeLineIndex: -1,
  mode: 'watch',
  isLoaded: false,
  isCompleted: false,
  isLocked: false,
  lockMessage: null,
  sidebarWidth: 400,
  seekToTime: null,
  isRecording: false,
  shadowingResult: null,
  isAutoNext: false,
  shadowingStats: {},
  availableTracks: [],
  trackMetadata: { s1: null, s2: null, s3: null },
  trackIds: { s1: null, s2: null, s3: null, ai: null },
  aiInsights: [],
  aiStatus: 'empty',
  aiProgress: { processed: 0, total: 0 },
  aiSummary: null,
  abLoop: { start: null, end: null, enabled: false },

  settings: {
    s1: defaultTrackSettings(2.5, '#ffffff', 0.6, 12),
    s2: defaultTrackSettings(1.8, '#34d399', 0.4, 28),
    s3: defaultTrackSettings(1.5, '#facc15', 0.3, 44),
    notes: { enabled: true, beforeSecs: 2, duration: 5, position: 75, alignment: 'bottomCenter', theme: 'classic', fontSize: 1.8 },
    community: { enabled: false, mode: 'danmaku', fontSize: 1.4, opacity: 0.9 },
    syncOffset: 0
  },

  setCurrentTime: (time) => {
    const { subtitles, activeLineIndex, abLoop, requestSeek, isSeeking, lastSeekTime, settings, mode, isPlaying } = get();
    if (mode === 'shadowing' && isPlaying && activeLineIndex !== -1) {
        const activeLine = subtitles[activeLineIndex];
        if (time > activeLine.end + 0.3) {
            set({ isPlaying: false, currentTime: time });
            return;
        }
    }
    if (isSeeking || (Date.now() - lastSeekTime < 1500)) return; 
    set({ currentTime: time });
    if (abLoop.enabled && abLoop.start !== null && abLoop.end !== null && time >= abLoop.end) {
        requestSeek(abLoop.start);
    }
    const adjustedTime = time + (settings.syncOffset || 0);
    const newIndex = subtitles.findIndex(line => adjustedTime >= line.start && adjustedTime <= line.end);
    if (newIndex !== -1 && newIndex !== activeLineIndex && mode !== 'shadowing') {
      set({ activeLineIndex: newIndex, lastAnalyzedIndex: newIndex });
      const targetLine = subtitles[newIndex];
      if (targetLine && targetLine.text) get().fetchAnalyzedWords(targetLine.text, get().originalLang);
    }
  },

  setPlaying: (isPlaying) => {
    if (get().isLockedPaused && isPlaying) return;
    set({ isPlaying });
  },
  setLockedPaused: (isLocked) => {
    set({ isLockedPaused: isLocked });
    if (isLocked) set({ isPlaying: false });
  },
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  requestSeek: (time, newIndex) => {
    const { subtitles } = get();
    const targetIndex = newIndex !== undefined ? newIndex : subtitles.findIndex(l => time >= l.start && l.end);
    set({ 
      seekToTime: time, lastSeekTime: Date.now(), currentTime: time,
      activeLineIndex: targetIndex !== -1 ? targetIndex : get().activeLineIndex,
      isSeeking: true, lastAnalyzedIndex: targetIndex !== -1 ? targetIndex : get().activeLineIndex
    });
    if (targetIndex !== -1) get().fetchAnalyzedWords(subtitles[targetIndex].text, get().originalLang);
  },
  setSeeking: (isSeeking) => set({ isSeeking }),
  setRecording: (isRecording) => set({ isRecording }),
  setShadowingResult: (result) => set({ shadowingResult: result }),
  toggleNativeCC: () => set(state => ({ isNativeCCOn: !state.isNativeCCOn })),
  setNativeCCLang: (lang) => set({ nativeCCLang: lang }),
  toggleCommunity: () => {
    const { settings } = get();
    set({ settings: { ...settings, community: { ...settings.community, enabled: !settings.community.enabled } } });
  },
  setCommunitySettings: (newSettings) => {
    const { settings } = get();
    set({ settings: { ...settings, community: { ...settings.community, ...newSettings } } });
  },
  fetchComments: async (video_id) => {
    try {
        const res = await axios.get(`/api/community/comments/${video_id}`);
        set({ comments: res.data });
    } catch (err) {}
  },
  addComment: async (video_id, content, timestamp) => {
    try {
        const res = await axios.post(`/api/community/comments/${video_id}`, { content, video_timestamp: timestamp });
        set(state => ({ 
            comments: [...state.comments, res.data.comment].sort((a, b) => (a.video_timestamp || 0) - (b.video_timestamp || 0)) 
        }));
    } catch (err) {}
  },
  addListeningTime: (seconds) => set(state => ({ sessionListeningSeconds: state.sessionListeningSeconds + seconds })),
  addShadowingCount: (count, duration) => set(state => ({ 
      sessionShadowingCount: state.sessionShadowingCount + count,
      sessionShadowingSeconds: state.sessionShadowingSeconds + duration
  })),
  flushTrackingData: async () => {
      const state = get();
      if (state.sessionListeningSeconds === 0 && state.sessionShadowingCount === 0) return;
      const payload = {
          lesson_id: state.lessonId,
          listening_seconds: state.sessionListeningSeconds,
          shadowing_count: state.sessionShadowingCount,
          shadowing_seconds: state.sessionShadowingSeconds
      };
      set(s => ({ 
          initialListeningSeconds: s.initialListeningSeconds + state.sessionListeningSeconds,
          sessionListeningSeconds: 0, sessionShadowingCount: 0, sessionShadowingSeconds: 0
      }));
      try {
           const res = await axios.post(`/api/study/lesson/${payload.lesson_id}/track-time`, { seconds_added: payload.listening_seconds });
           if (res.data.success) useAppStore.getState().checkNewBadges();
      } catch (err) {
          set(s => ({
              initialListeningSeconds: s.initialListeningSeconds - payload.listening_seconds,
              sessionListeningSeconds: s.sessionListeningSeconds + payload.listening_seconds,
              sessionShadowingCount: s.sessionShadowingCount + payload.shadowing_count,
              sessionShadowingSeconds: s.sessionShadowingSeconds + payload.shadowing_seconds
          }));
      }
  },
  setTrackSettings: (track, newSettings) => set((state) => ({
      settings: { ...state.settings, [track]: { ...state.settings[track], ...newSettings } }
  })),
  setAvailableTracks: (tracks) => set({ availableTracks: tracks }),
  setTrackIds: (newIds) => {
    const state = get();
    const updatedIds = { ...state.trackIds, ...newIds };
    set({ trackIds: updatedIds });
    const fetchTrack = async (tid: number | string | null, trackKey: 's1Lines' | 's2Lines' | 's3Lines') => {
        if (!tid || !state.lessonId) { set({ [trackKey]: [] } as any); return; }
        try {
            const r = await axios.get(`/api/content/subtitles/${tid}`);
            set(state => ({ trackMetadata: { ...state.trackMetadata, [trackKey]: r.data } }));
            let worker = get().subtitleWorker;
            if (!worker) {
                worker = new Worker(new URL('../workers/subtitleWorker.ts', import.meta.url), { type: 'module' });
                set({ subtitleWorker: worker });
            }
            worker.postMessage({ type: 'PARSE_SUBTITLES', data: { rawJson: r.data.content || [] } });
            worker.onmessage = (e) => {
                if (e.data.type === 'PARSE_SUBTITLES_COMPLETE') {
                    set({ [trackKey]: e.data.data } as any);
                    if (trackKey === 's1Lines') set({ subtitles: e.data.data });
                }
            };
        } catch (e) {}
    };
    if (newIds.s1 !== undefined) fetchTrack(updatedIds.s1, 's1Lines');
    if (newIds.s2 !== undefined) fetchTrack(updatedIds.s2, 's2Lines');
    if (newIds.s3 !== undefined) fetchTrack(updatedIds.s3, 's3Lines');
  },
  fetchAvailableTracks: async () => {
      const { lessonId } = get();
      if (!lessonId) return;
      try {
          const res = await axios.get(`/api/study/subtitles/available/${lessonId}`);
          set({ availableTracks: res.data.subtitles || [] });
      } catch (e) {}
  },
  translateTrack: async (trackId, targetLang, name) => {
      try {
          await axios.post(`/api/content/subtitles/${trackId}/translate`, { target_lang: targetLang, name });
          get().fetchAvailableTracks();
      } catch (e) {}
  },
  exportTrack: async (trackId, format) => {
      window.open(`/api/content/subtitles/${trackId}/export?format=${format}`);
  },
  updateTrackName: async (trackId, name) => {
      try {
          await axios.patch(`/api/content/subtitles/${trackId}`, { name });
          get().fetchAvailableTracks();
      } catch (e) {}
  },
  toggleHandsFreeMode: () => get().setHandsFreeModeEnabled(!get().handsFreeModeEnabled),
  setHandsFreeModeEnabled: (enabled) => set(() => ({ 
    handsFreeModeEnabled: enabled, handsFreeStatus: 'idle' as const,
    ...(!enabled ? { handsFreeAudioUrl: null, handsFreeTimeline: null, handsFreeTaskId: null, handsFreeProgress: 0, handsFreeStep: '' } : {})
  })),
  setHandsFreeType: (type) => set({ handsFreeType: type }),
  setHandsFreeStatus: (status) => set({ handsFreeStatus: status }),
  setHandsFreeAudioData: (audioUrl, timeline, duration) => set({ handsFreeAudioUrl: audioUrl, handsFreeTimeline: timeline, handsFreeDuration: duration }),
  setHandsFreeOriginalData: (audioUrl, duration) => set({ handsFreeOriginalUrl: audioUrl, handsFreeDuration: duration }),
  setHandsFreeTaskId: (id) => set({ handsFreeTaskId: id }),
  setHandsFreeProgress: (progress, step) => set({ handsFreeProgress: progress, handsFreeStep: step }),
  setTTSTrackSource: (source) => set({ ttsTrackSource: source }),
  generateHandsFreeMixed: () => set({ handsFreeAudioUrl: null, handsFreeTimeline: null, handsFreeTaskId: null, handsFreeStatus: 'idle' }),
  setAbLoop: (newLoop) => set((state) => ({ abLoop: { ...state.abLoop, ...newLoop } })),
  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((state) => ({ notes: [...state.notes, note].sort((a,b) => a.timestamp - b.timestamp) })),
  setNoteSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, notes: { ...state.settings.notes, ...newSettings } } })),
  setSyncOffset: (offset) => set((state) => ({ settings: { ...state.settings, syncOffset: offset } })),
  deleteNote: (id) => set((state) => ({ notes: state.notes.filter(n => n.id !== id) })),
  updateNote: (id, content) => set((state) => ({ notes: state.notes.map(n => n.id === id ? { ...n, content } : n) })),
  setLessonData: (data) => set((state) => {
    let newSettings = { ...state.settings };
    if (data.settings) newSettings = { ...newSettings, ...data.settings };
    return { 
        ...state,
        lessonId: data.lesson_id || data.id, 
        videoId: data.video_id, 
        lessonTitle: data.title,
        availableTracks: data.subtitles?.available_tracks || [],
        settings: newSettings,
        isCompleted: data.is_completed || false,
        isLoaded: true 
    };
  }),
  setAutoNext: (isAutoNext) => set({ isAutoNext }),
  setMode: (mode) => set({ mode }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  fetchLessonData: async (id) => {
    const state = get();
    if (!(state.lessonId === id && state.isLoaded && state.videoId)) {
        set({ isLoaded: false, lessonId: id, videoId: null, subtitles: [], s1Lines: [], s2Lines: [], s3Lines: [], activeLineIndex: -1 });
    }
    try {
        const res = await axios.get(`/api/content/player/lesson/${id}`);
        const m = res.data.lesson;
        const subs = res.data.subtitles;
        get().setLessonData({ ...m, subtitles: subs });
        const trackIds = { s1: subs.track_1_id, s2: subs.track_2_id, s3: subs.track_3_id, ai: null };
        get().setTrackIds(trackIds);
        get().checkScanStatus(id);
    } catch (e) { set({ isLoaded: false }); }
  },
  completeLesson: async () => {}, 
  fetchNotes: async () => {},
  fetchShadowingStats: async () => {},
  setAIInsights: (data) => set({ aiInsights: data }),
  fetchAIInsights: async () => {},
  analyzeLine: async (index) => {
      const { subtitles, trackIds } = get();
      const line = subtitles[index];
      if (!line) return;
      try {
          await axios.post('/api/content/ai/analyze-sentence', { track_id: trackIds.s1, line_index: index, text: line.text });
      } catch (e) {}
  },
  setAnalyzedWords: (words) => set({ analyzedWords: words }),
  toggleFurigana: () => set(s => ({ showFurigana: !s.showFurigana })),
  fetchAnalyzedWords: async (text, lang) => {
      try {
          const res = await axios.post('/api/study/vocab/analyze', { text, lang });
          set({ analyzedWords: res.data });
      } catch (e) {}
  },
  checkScanStatus: async (id) => {
      const lid = id || get().lessonId;
      if (!lid) return;
      try {
          const res = await axios.get(`/api/study/vocab/scan-status/${lid}`);
          set({ hasTokens: res.data.has_tokens });
      } catch (e) {}
  },
  scanFullLesson: async (priority) => {
      const { lessonId, s1Lines } = get();
      if (!lessonId || s1Lines.length === 0) return;
      try {
          const texts = s1Lines.map(l => l.text);
          await axios.post('/api/study/vocab/sync-batch', { 
              lesson_id: lessonId, 
              texts, 
              is_first_batch: true,
              priority 
          });
          set({ hasTokens: true });
      } catch (e) {}
  },
  saveSettings: async () => {},
  saveAsDefaultPreferences: async () => {
      try {
          await axios.post('/api/study/user/preferences', get().settings);
      } catch (e) {}
  },
  skipNextSentence: () => {},
  skipPrevSentence: () => {},
  updateSubtitleLine: async (trackKey, index, data) => {
      const trackId = get().trackIds[trackKey];
      try {
          await axios.patch(`/api/content/subtitles/${trackId}/line/${index}`, data);
      } catch (e) {}
  },
  splitSubtitleLine: async () => {},
  mergeSubtitleLine: async () => {},
  deleteSubtitleLine: async () => {},
  shiftSubtitleTrack: () => {},
  saveTrackShifts: async () => {}
}));
