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
  isLockedPaused: boolean; // NEW: Lock to prevent auto-play during curation
  
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
  isLocked: boolean; // NEW: Lock for membership limits
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
  isSeeking: boolean; // NEW: Lock for navigation
  
  // NEW: Curated Content
  curatedContent: {
    overview: string;
    grammar: string;
    vocabulary: string;
  };
  fetchCuratedContent: () => Promise<void>;
  updateCuratedContent: (data: Partial<PlayerState['curatedContent']>) => Promise<void>;
  
  isNativeCCOn: boolean; // NEW: YouTube Native CC Toggle
  nativeCCLang: string;
  comments: any[];
  
  // NEW: Gamification Tracking
  initialListeningSeconds: number;
  sessionListeningSeconds: number;
  sessionShadowingCount: number;
  sessionShadowingSeconds: number;
  
  // NEW: Learning Focus Area (Bottom Area)
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
  setLockedPaused: (isLocked: boolean) => void; // NEW
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
  
  // Gamification Tracking Actions
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
  
  // NEW: Focus Area Actions
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

  curatedContent: {
    overview: '',
    grammar: '',
    vocabulary: ''
  },
  fetchCuratedContent: async () => {
    const { videoId } = get();
    if (!videoId) return;
    try {
        const res = await axios.get(`/api/content/curated/${videoId}`);
        set({ curatedContent: res.data });
    } catch (e) { console.error("Failed to fetch curated content", e); }
  },
  updateCuratedContent: async (data) => {
    const { videoId, curatedContent } = get();
    if (!videoId) return;
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.patch(`/api/content/curated/${videoId}`, data, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        set({ curatedContent: { ...curatedContent, ...data } });
    } catch (e) { 
        console.error("Failed to update curated content", e);
        throw e;
    }
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
    notes: {
        enabled: true,
        beforeSecs: 2,
        duration: 5,
        position: 75,
        alignment: 'bottomCenter',
        theme: 'classic',
        fontSize: 1.8
    },
    community: {
        enabled: false,
        mode: 'danmaku',
        fontSize: 1.4,
        opacity: 0.9
    },
    syncOffset: 0
  },

  setCurrentTime: (time) => {
    const { subtitles, activeLineIndex, abLoop, requestSeek, isSeeking, lastSeekTime, settings } = get();
    
    // overwriting the state before the player actually seeks.
    // Increased to 1000ms because YouTube player can be slow to report new position.
    if (isSeeking || (Date.now() - lastSeekTime < 1000)) {
      return; 
    }

    set({ currentTime: time });
    
    if (abLoop.enabled) {
      if (abLoop.start !== null && abLoop.end !== null && time >= abLoop.end) {
        requestSeek(abLoop.start);
      }
    }
    
    const adjustedTime = time + (settings.syncOffset || 0);
    const newIndex = subtitles.findIndex(line => adjustedTime >= line.start && adjustedTime <= line.end);
    
    // Auto-pause at end of sentence in shadowing mode
    // Strategy: detect when the player LEAVES the current subtitle line
    // (either into a gap or into the next line). This is 100% reliable
    // regardless of polling interval, unlike a tiny time-window check.
    const { mode, isPlaying } = get();
    if (mode === 'shadowing' && isPlaying && activeLineIndex !== -1) {
        if (newIndex !== activeLineIndex) {
            // We left the active line — pause immediately
            set({ isPlaying: false });
            return;
        }
    }

    if (newIndex !== -1 && newIndex !== activeLineIndex) {
      set({ activeLineIndex: newIndex, lastAnalyzedIndex: newIndex });
      
      // Auto-analyze for focus area
      const targetLine = subtitles[newIndex];
      if (targetLine && targetLine.text) {
          get().fetchAnalyzedWords(targetLine.text, get().originalLang);
      }
    }
  },

  setPlaying: (isPlaying) => {
    const { isLockedPaused } = get();
    // If locked, we force play state to false
    if (isLockedPaused && isPlaying) return;
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
    // Use directly provided index OR find it
    const targetIndex = newIndex !== undefined ? newIndex : subtitles.findIndex(l => time >= l.start && time <= l.end);
    
    set({ 
      seekToTime: time, 
      lastSeekTime: Date.now(),
      currentTime: time,
      activeLineIndex: targetIndex !== -1 ? targetIndex : get().activeLineIndex,
      isSeeking: true,
      lastAnalyzedIndex: targetIndex !== -1 ? targetIndex : get().activeLineIndex
    });

    if (targetIndex !== -1) {
        get().fetchAnalyzedWords(subtitles[targetIndex].text, get().originalLang);
    }
  },
  setSeeking: (isSeeking) => set({ isSeeking }),
  setRecording: (isRecording) => set({ isRecording }),
  setShadowingResult: (result) => set({ shadowingResult: result }),
  toggleNativeCC: () => set(state => ({ isNativeCCOn: !state.isNativeCCOn })),
  setNativeCCLang: (lang) => set({ nativeCCLang: lang }),

  toggleCommunity: () => {
    const { settings } = get();
    set({ 
      settings: { 
        ...settings, 
        community: { ...settings.community, enabled: !settings.community.enabled } 
      } 
    });
  },

  setCommunitySettings: (newSettings: Partial<PlayerState['settings']['community']>) => {
    const { settings } = get();
    set({ 
      settings: { 
        ...settings, 
        community: { ...settings.community, ...newSettings } 
      } 
    });
  },
  
  fetchComments: async (video_id) => {
    try {
        const response = await fetch(`/api/community/comments/${video_id}`);
        if (response.ok) {
            const data = await response.json();
            set({ comments: data });
        }
    } catch (err) {
        console.error("Fetch comments failed", err);
    }
  },

  addComment: async (video_id, content, timestamp) => {
    try {
        const response = await fetch(`/api/community/comments/${video_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': (window as any).__PODLEARN_DATA__?.csrf_token || ''
            },
            body: JSON.stringify({ content, video_timestamp: timestamp })
        });
        if (response.ok) {
            const data = await response.json();
            set(state => ({ 
                comments: [...state.comments, data.comment].sort((a, b) => (a.video_timestamp || 0) - (b.video_timestamp || 0)) 
            }));
        }
    } catch (err) {
        console.error("Post comment failed", err);
    }
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

      // Optimistically clear the counts locally right away to avoid double flushing
      // And add them to initialListeningSeconds to keep the UI timer smooth
      set(s => ({ 
          initialListeningSeconds: s.initialListeningSeconds + state.sessionListeningSeconds,
          sessionListeningSeconds: 0, 
          sessionShadowingCount: 0,
          sessionShadowingSeconds: 0
      }));

      try {
          // Use fetch for API call (CSRF handled internally by app or bypass)
           const response = await fetch('/api/tracking/ping', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
                   'X-CSRFToken': (window as any).__PODLEARN_DATA__?.csrf_token || ''
               },
               body: JSON.stringify(payload)
           });
           if (!response.ok) {
               const errorData = await response.json().catch(() => ({}));
               if (response.status === 403 && errorData.is_locked) {
                   set({ 
                       isLocked: true, 
                       lockMessage: errorData.message || 'Giới hạn học tập đã hết.',
                       isPlaying: false 
                   });
               } else {
                   // Re-add on failure (network error etc)
                   set(s => ({
                       initialListeningSeconds: s.initialListeningSeconds - payload.listening_seconds,
                       sessionListeningSeconds: s.sessionListeningSeconds + payload.listening_seconds,
                       sessionShadowingCount: s.sessionShadowingCount + payload.shadowing_count,
                       sessionShadowingSeconds: s.sessionShadowingSeconds + payload.shadowing_seconds
                   }));
               }
           } else {
               // Success: trigger badge check
               useAppStore.getState().checkNewBadges();
           }
      } catch (err) {
          // Re-add on failure
          set(s => ({
              initialListeningSeconds: s.initialListeningSeconds - payload.listening_seconds,
              sessionListeningSeconds: s.sessionListeningSeconds + payload.listening_seconds,
              sessionShadowingCount: s.sessionShadowingCount + payload.shadowing_count,
              sessionShadowingSeconds: s.sessionShadowingSeconds + payload.shadowing_seconds
          }));
      }
  },

  setTrackSettings: (track, newSettings) => set((state) => ({
      settings: {
          ...state.settings,
          [track]: { ...state.settings[track], ...newSettings }
      }
  })),

  setAvailableTracks: (tracks) => set({ availableTracks: tracks }),
  setTrackIds: (newIds) => {
    const state = get();
    const updatedIds = { ...state.trackIds, ...newIds };
    set({ trackIds: updatedIds });

    const fetchTrack = async (tid: number | string | null, trackKey: 's1Lines' | 's2Lines' | 's3Lines') => {
        if (!tid || !state.lessonId) {
            set({ [trackKey]: [] } as any);
            return;
        }
        try {
            const r = await axios.get(`/api/subtitles/fetch/${state.lessonId}`, { params: { track_id: tid } });
            
            // Fetch track metadata
            const metaRes = await axios.get(`/api/subtitles/video/${state.lessonId}`);
            const meta = metaRes.data.find((t: any) => t.id === tid);
            set(state => ({
                trackMetadata: { ...state.trackMetadata, [trackKey]: meta }
            }));

            // Use Web Worker for processing
            let worker = get().subtitleWorker;
            if (!worker) {
                worker = new Worker(new URL('../workers/subtitleWorker.ts', import.meta.url), { type: 'module' });
                set({ subtitleWorker: worker });
            }

            worker.postMessage({ type: 'PARSE_SUBTITLES', data: { rawJson: r.data.lines || [] } });
            worker.onmessage = (e) => {
                if (e.data.type === 'PARSE_SUBTITLES_COMPLETE') {
                    set({ [trackKey]: e.data.data } as any);
                    if (trackKey === 's1Lines') {
                        set({ subtitles: e.data.data });
                    }
                }
            };
        } catch (e) { console.error(`Failed to fetch ${trackKey}`, e); }
    };

    if (newIds.s1 !== undefined) fetchTrack(updatedIds.s1, 's1Lines');
    if (newIds.s2 !== undefined) fetchTrack(updatedIds.s2, 's2Lines');
    if (newIds.s3 !== undefined) fetchTrack(updatedIds.s3, 's3Lines');
  },
  toggleHandsFreeMode: () => get().setHandsFreeModeEnabled(!get().handsFreeModeEnabled),
  setHandsFreeModeEnabled: (enabled) => set(() => ({ 
    handsFreeModeEnabled: enabled,
    handsFreeStatus: 'idle' as const,
    // Reset generation state when disabling
    ...(!enabled ? {
        handsFreeAudioUrl: null,
        handsFreeTimeline: null,
        handsFreeTaskId: null,
        handsFreeProgress: 0,
        handsFreeStep: ''
    } : {})
  })),
  setHandsFreeType: (type) => set({ handsFreeType: type }),
  setHandsFreeStatus: (status: PlayerState['handsFreeStatus']) => set({ handsFreeStatus: status }),
  setHandsFreeAudioData: (audioUrl, timeline, duration) => set({ 
    handsFreeAudioUrl: audioUrl, 
    handsFreeTimeline: timeline, 
    handsFreeDuration: duration 
  }),
  setHandsFreeOriginalData: (audioUrl, duration) => set({
    handsFreeOriginalUrl: audioUrl,
    handsFreeDuration: duration
  }),
  setHandsFreeTaskId: (id) => set({ handsFreeTaskId: id }),
  setHandsFreeProgress: (progress, step) => set({ handsFreeProgress: progress, handsFreeStep: step }),
  setTTSTrackSource: (source) => set({ ttsTrackSource: source }),
  generateHandsFreeMixed: () => {
    set({ 
        handsFreeAudioUrl: null, 
        handsFreeTimeline: null,
        handsFreeTaskId: null,
        handsFreeStatus: 'idle' 
    });
  },
  setAbLoop: (newLoop) => set((state) => ({
    abLoop: { ...state.abLoop, ...newLoop }
  })),
  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((state) => ({ 
      notes: [...state.notes, note].sort((a,b) => a.timestamp - b.timestamp) 
  })),
  setNoteSettings: (newSettings) => set((state) => ({
    settings: {
        ...state.settings,
        notes: { ...state.settings.notes, ...newSettings }
    }
  })),
  setSyncOffset: (offset) => set((state) => ({
    settings: { ...state.settings, syncOffset: offset }
  })),
  deleteNote: (id) => set((state) => ({ 
      notes: state.notes.filter(n => n.id !== id) 
  })),
  updateNote: (id, content) => set((state) => ({
      notes: state.notes.map(n => n.id === id ? { ...n, content } : n)
  })),
  setLessonData: (data) => set((state) => {
    let newSettings = { ...state.settings };
    
    // 1. Start with Global Preferences if provided in data (we'll fetch them in fetchLessonData)
    if (data.global_preferences) {
        newSettings = { ...newSettings, ...data.global_preferences };
    }

    // 2. Override with Lesson Specific Settings if they exist
    if (data.settings_json) {
        try {
            const saved = typeof data.settings_json === 'string' 
                ? JSON.parse(data.settings_json) 
                : data.settings_json;
            if (saved && typeof saved === 'object') {
                newSettings = {
                    ...newSettings,
                    ...saved,
                    s1: { ...newSettings.s1, ...(saved.s1 || {}) },
                    s2: { ...newSettings.s2, ...(saved.s2 || {}) },
                    s3: { ...newSettings.s3, ...(saved.s3 || {}) },
                    notes: { ...newSettings.notes, ...(saved.notes || {}) },
                    syncOffset: saved.syncOffset !== undefined ? saved.syncOffset : newSettings.syncOffset
                };
            }
        } catch (e) { console.warn("Recovered from malformed settings_json", e); }
    }
    return { 
        ...state,
        lessonId: data.lesson_id || data.lessonId || state.lessonId, 
        videoId: data.video_id || data.videoId || state.videoId, 
        lessonTitle: data.lesson_title || data.lessonTitle || state.lessonTitle,
        availableTracks: data.available_tracks || data.availableTracks || state.availableTracks,
        settings: newSettings,
        isCompleted: data.is_completed || data.isCompleted || false,
        isLoaded: true 
    };
  }),
  setAutoNext: (isAutoNext) => set({ isAutoNext }),
  setMode: (mode) => set({ mode }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  fetchLessonData: async (id) => {
    const state = get();
    if (!(state.lessonId === id && state.isLoaded && state.videoId)) {
        set({ 
          isLoaded: false, lessonId: id, videoId: null, 
          isLocked: false, lockMessage: null,
          subtitles: [], s1Lines: [], s2Lines: [], s3Lines: [], 
          activeLineIndex: -1, availableTracks: [] 
        });
    }
    try {
        // 1. Fetch Global Preferences and Scan Status First
        const [metaRes, prefRes, _] = await Promise.all([
            axios.get(`/api/subtitles/fetch/${id}`),
            axios.get('/api/user/preferences').catch(() => ({ data: {} })),
            get().checkScanStatus(id)
        ]);
        
        if (get().lessonId !== id) return;
        
        const m = { 
            ...metaRes.data, 
            global_preferences: prefRes.data 
        };
        
        get().setLessonData(m);
        const trackIds = {
            s1: m.metadata?.s1_track_id || m.track_id,
            s2: m.metadata?.s2_track_id || null,
            s3: m.metadata?.s3_track_id || null,
            ai: m.metadata?.ai_track_id || null
        };
        const fetchTrack = async (tid: number | string | null) => {
            if (!tid) return [];
            try {
                const r = await axios.get(`/api/subtitles/fetch/${id}`, { params: { track_id: tid } });
                return r.data.lines || [];
            } catch (e) { return []; }
        };
        const [l1, l2, l3, aiRes] = await Promise.all([
            fetchTrack(trackIds.s1), fetchTrack(trackIds.s2), fetchTrack(trackIds.s3),
            axios.get(`/api/ai/insights/${m.video_id}`).catch(() => ({ data: { insights: [] } }))
        ]);
        if (get().lessonId !== id) return;
        set({ 
            lessonTitle: m.lesson_title, videoId: m.video_id,
            originalLang: m.metadata?.original_lang || 'ja',
            subtitles: l1, s1Lines: l1, s2Lines: l2, s3Lines: l3,
            availableTracks: m.available_tracks || [], trackIds, isCompleted: m.is_completed || false,
            initialListeningSeconds: m.total_time_spent || 0, isLoaded: true 
        });
        if (aiRes.data) {
            set({
                aiInsights: aiRes.data.insights || [],
                aiStatus: aiRes.data.status || 'empty',
                aiProgress: { processed: aiRes.data.processed_lines || 0, total: aiRes.data.total_lines || 0 },
                aiSummary: aiRes.data.overall_summary || null
            });
        }
        
        // 2. Fetch Curated Content
        const curatedRes = await axios.get(`/api/content/curated/${m.video_id}`).catch(() => ({ data: { overview: '', grammar: '', vocabulary: '' } }));
        if (get().lessonId === id) set({ curatedContent: curatedRes.data });

        const notesRes = await axios.get(`/api/lesson/${id}/notes`);
        if (notesRes.data.notes && get().lessonId === id) set({ notes: notesRes.data.notes });
    } catch (err: any) { 
        console.error("Fetch lesson failed", err); 
        if (err.response && err.response.status === 403 && err.response.data?.is_locked) {
            set({ 
                isLocked: true, 
                lockMessage: err.response.data.message || 'Giới hạn học tập đã hết.',
                isLoaded: true 
            });
        } else {
            set({ isLoaded: true }); 
        }
    }
  },
  completeLesson: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const response = await fetch(`/api/lesson/${lessonId}/complete`, { method: 'POST' });
        if ((await response.json()).success) {
            set({ isCompleted: true });
            useAppStore.getState().checkNewBadges();
        }
    } catch (e) { console.error("Failed to complete lesson", e); }
  },
  fetchNotes: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/lesson/${lessonId}/notes`);
        if (res.data.notes) set({ notes: res.data.notes });
    } catch (e) { console.error("Failed to fetch notes", e); }
  },
  fetchShadowingStats: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/lesson/${lessonId}/shadowing-stats`);
        if (res.data.stats) set({ shadowingStats: res.data.stats });
    } catch (e) { console.error("Failed to fetch shadowing stats", e); }
  },
  setAIInsights: (data: any) => set({
    aiInsights: data.insights || [],
    aiStatus: data.status || 'empty',
    aiProgress: { processed: data.processed_lines || 0, total: data.total_lines || 0 },
    aiSummary: data.overall_summary || null
  }),
  fetchAIInsights: async () => {
    const { videoId } = get();
    if (!videoId) return;
    try {
        const res = await axios.get(`/api/ai/insights/${videoId}`);
        get().setAIInsights(res.data);
    } catch (e) { console.error("Failed to fetch AI insights", e); }
  },
  analyzeLine: async (index: number) => {
    const { videoId, aiInsights } = get();
    if (!videoId) return;
    try {
        const res = await axios.post(`/api/ai/insights/${videoId}/line/${index}`, {}, { withCredentials: true });
        if (res.data.success && res.data.insight) {
            const newInsights = [...aiInsights];
            const existingIdx = newInsights.findIndex(it => it.index === index);
            if (existingIdx !== -1) newInsights[existingIdx] = res.data.insight;
            else newInsights.push(res.data.insight);
            set({ aiInsights: newInsights });
        }
    } catch (e) { console.error("Failed to analyze line", e); throw e; }
  },
  setAnalyzedWords: (words) => set({ analyzedWords: words }),
  toggleFurigana: () => set(s => ({ showFurigana: !s.showFurigana })),
  checkScanStatus: async (id) => {
    const lessonId = id || get().lessonId;
    if (!lessonId) return;
    try {
      const res = await axios.get(`/api/vocab/scan-status/${lessonId}`);
      set({ hasTokens: res.data.has_tokens });
    } catch (e) { console.error("Failed check scan status", e); }
  },
  scanFullLesson: async (priority) => {
    const { lessonId, fetchAnalyzedWords, subtitles, activeLineIndex } = get();
    if (!lessonId) return;
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.post('/api/vocab/generate-all', { 
            lesson_id: lessonId, 
            priority: priority || 'mazii_offline' 
        }, { headers: { 'X-CSRF-Token': csrfToken } });
        set({ hasTokens: true });
        // Refresh analysis for current line if needed
        const currentLine = subtitles[activeLineIndex];
        if (currentLine) {
            await fetchAnalyzedWords(currentLine.text, 'ja');
        }
    } catch (e) {
        console.error("Scan failed", e);
        throw e;
    }
  },
  fetchAnalyzedWords: async (text, lang) => {
    const { lessonId, activeLineIndex } = get();
    if (!text || activeLineIndex === -1) return;
    try {
      const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
      const res = await axios.post('/api/video/analyze-sentence', { 
        text, 
        lang, 
        lesson_id: lessonId,
        active_line_index: activeLineIndex
      }, { headers: { 'X-CSRF-Token': csrfToken } });
      set({ 
        analyzedWords: res.data.words || [],
        isManualAnalysis: res.data.is_manual || false,
        lastAnalyzedIndex: activeLineIndex
      });
    } catch (e) {
      console.error("Analysis failed", e);
      set({ analyzedWords: [{"surface": text, "original": text, "reading": null}] });
    }
  },
  splitSubtitleLine: async (trackKey, index, time) => {
    const { trackIds } = get();
    const trackId = trackIds[trackKey];
    if (!trackId) return;
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        const res = await axios.post(`/api/subtitles/${trackId}/line/${index}/split`, { time }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        if (res.data.success) {
            const stateKey = trackKey === 's1' ? 's1Lines' : trackKey === 's2' ? 's2Lines' : 's3Lines';
            set({ [stateKey]: res.data.lines });
        } else {
            alert(res.data.error || "Split failed");
        }
    } catch (e) { console.error("Split failed", e); alert("Split failed"); }
  },
  mergeSubtitleLine: async (trackKey, index) => {
    const { trackIds } = get();
    const trackId = trackIds[trackKey];
    if (!trackId) return;
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        const res = await axios.post(`/api/subtitles/${trackId}/line/${index}/merge`, {}, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        if (res.data.success) {
            const stateKey = trackKey === 's1' ? 's1Lines' : trackKey === 's2' ? 's2Lines' : 's3Lines';
            set({ [stateKey]: res.data.lines });
        } else {
            alert(res.data.error || "Merge failed");
        }
    } catch (e) { console.error("Merge failed", e); alert("Merge failed"); }
  },
  deleteSubtitleLine: async (trackKey, index) => {
    const { trackIds } = get();
    const trackId = trackIds[trackKey];
    if (!trackId) return;
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        const res = await axios.delete(`/api/subtitles/${trackId}/line/${index}`, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        if (res.data.success) {
            const stateKey = trackKey === 's1' ? 's1Lines' : trackKey === 's2' ? 's2Lines' : 's3Lines';
            set({ [stateKey]: res.data.lines });
        } else {
            alert(res.data.error || "Delete failed");
        }
    } catch (e) { console.error("Delete failed", e); alert("Delete failed"); }
  },
  skipNextSentence: () => {
    const { subtitles, currentTime, requestSeek } = get();
    const currentIndex = subtitles.findIndex(line => currentTime >= line.start && currentTime <= line.end);
    if (currentIndex !== -1 && currentIndex < subtitles.length - 1) {
      requestSeek(subtitles[currentIndex + 1].start + 0.05, currentIndex + 1);
    } else {
      const nextIdx = subtitles.findIndex(line => line.start > currentTime + 0.05);
      if (nextIdx !== -1) requestSeek(subtitles[nextIdx].start + 0.05, nextIdx);
    }
  },
  skipPrevSentence: () => {
    const { subtitles, currentTime, requestSeek } = get();
    const currentIndex = subtitles.findIndex(line => currentTime >= line.start && currentTime <= line.end);
    if (currentIndex !== -1) {
      const currentLine = subtitles[currentIndex];
      if (currentTime - currentLine.start > 1.2) requestSeek(currentLine.start + 0.05, currentIndex);
      else if (currentIndex > 0) requestSeek(subtitles[currentIndex - 1].start + 0.05, currentIndex - 1);
    } else {
      const rSubtitles = [...subtitles].reverse();
      const prevLine = rSubtitles.find(line => line.start < currentTime - 0.5);
      if (prevLine) {
         const originalIndex = subtitles.findIndex(l => l.start === prevLine.start);
         requestSeek(prevLine.start + 0.05, originalIndex);
      }
    }
  },
  updateSubtitleLine: async (trackKey, index, data) => {
    const { trackIds, lessonId } = get();
    const trackId = trackIds[trackKey];
    if (!trackId || !lessonId) return;

    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        const res = await axios.patch(`/api/subtitles/${trackId}/line/${index}`, data, {
            headers: { 'X-CSRF-Token': csrfToken }
        });

        if (res.data.success) {
            const updatedLine = res.data.line;
            const stateKey = trackKey === 's1' ? 's1Lines' : trackKey === 's2' ? 's2Lines' : 's3Lines';
            
            set(state => {
                const lines = [...(state[stateKey] as SubtitleLine[])];
                if (lines[index]) {
                    lines[index] = { ...lines[index], ...updatedLine };
                }
                
                const updates: any = { [stateKey]: lines };
                // Also update the main 'subtitles' if we edited S1
                if (trackKey === 's1') {
                    updates.subtitles = lines;
                }
                
                return updates;
            });
        }
    } catch (err) {
        console.error("Failed to update subtitle line", err);
        throw err;
    }
  },

  shiftSubtitleTrack: (trackKey, offsetMs) => {
    const offset = offsetMs / 1000;
    const stateKey = trackKey === 's1' ? 's1Lines' : trackKey === 's2' ? 's2Lines' : 's3Lines';
    
    set(state => {
        const lines = (state[stateKey] as SubtitleLine[]).map(l => ({
            ...l,
            start: Math.max(0, l.start + offset),
            end: Math.max(0, l.end + offset)
        }));
        
        const updates: any = { [stateKey]: lines };
        if (trackKey === 's1') {
            updates.subtitles = lines;
        }
        return updates;
    });
  },

  saveTrackShifts: async (trackKey, totalOffsetMs) => {
    const { trackIds } = get();
    const trackId = trackIds[trackKey];
    if (!trackId) return;

    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.post(`/api/subtitles/${trackId}/shift`, { offset: totalOffsetMs / 1000 }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
    } catch (err) {
        console.error("Failed to save track shift", err);
        throw err;
    }
  },

  saveAsDefaultPreferences: async () => {
    const { settings } = get();
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.post('/api/user/preferences', settings, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
    } catch (err) {
        console.error("Failed to save default preferences", err);
        throw err;
    }
  },

  saveSettings: async () => {
    const { lessonId, settings, trackIds } = get();
    if (!lessonId) return;
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.post(`/api/lesson/${lessonId}/set-languages`, {
            s1_track_id: trackIds.s1, 
            s2_track_id: trackIds.s2, 
            s3_track_id: trackIds.s3, 
            settings: settings
        }, { headers: { 'X-CSRF-Token': csrfToken } });
    } catch (err) {
        console.error("Failed to save settings", err);
        throw err;
    }
  },

  fetchAvailableTracks: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/subtitles/video/${lessonId}`);
        set({ availableTracks: res.data });
        
        // If any track is translating, poll again in 3s
        const hasTranslating = res.data.some((t: any) => t.status === 'translating');
        if (hasTranslating) {
            setTimeout(() => get().fetchAvailableTracks(), 3000);
        }
    } catch (e) { console.error("Failed to fetch tracks", e); }
  },
  translateTrack: async (trackId, targetLang, name) => {
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.post(`/api/subtitles/${trackId}/translate`, { target_lang: targetLang, name }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        await get().fetchAvailableTracks();
    } catch (e) { console.error("Translation failed", e); alert("Translation failed"); }
  },
  exportTrack: async (trackId, format) => {
    window.open(`/api/subtitles/${trackId}/export?format=${format}`, '_blank');
  },
  updateTrackName: async (trackId, name) => {
    try {
        const csrfToken = (window as any).__PODLEARN_DATA__?.csrf_token || '';
        await axios.patch(`/api/subtitles/${trackId}`, { name }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        await get().fetchAvailableTracks();
    } catch (e) { console.error("Update failed", e); }
  }
}));
