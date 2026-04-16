import { create } from 'zustand';
import axios from 'axios';

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
  
  // UI / Interaction
  mode: 'watch' | 'shadowing' | 'loop';
  isLoaded: boolean;
  isCompleted: boolean;
  sidebarWidth: number;
  seekToTime: number | null;
  isRecording: boolean;
  shadowingResult: any | null;
  
  availableTracks: any[];
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
  aiSummary: string | null;
  isAutoNext: boolean;
  shadowingStats: Record<string, { count: number, avg: number, best: number }>;

  abLoop: {
    start: number | null;
    end: number | null;
    enabled: boolean;
  };
  lastSeekTime: number;
  isSeeking: boolean; // NEW: Lock for navigation
  
  isNativeCCOn: boolean; // NEW: YouTube Native CC Toggle
  nativeCCLang: string;
  isCommunityOn: boolean; // NEW: Community Toggle
  comments: any[];
  
  // NEW: Gamification Tracking
  initialListeningSeconds: number;
  sessionListeningSeconds: number;
  sessionShadowingCount: number;
  sessionShadowingSeconds: number;
  
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
  
  // Navigation
  skipNextSentence: () => void;
  skipPrevSentence: () => void;
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
  isSeeking: false,
  isNativeCCOn: false,
  nativeCCLang: 'ja',
  isCommunityOn: false,
  comments: [],
  
  initialListeningSeconds: 0,
  sessionListeningSeconds: 0,
  sessionShadowingCount: 0,
  sessionShadowingSeconds: 0,
  
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
  sidebarWidth: 400,
  seekToTime: null,
  isRecording: false,
  shadowingResult: null,
  isAutoNext: false,
  shadowingStats: {},

  availableTracks: [],
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
    }
  },

  setCurrentTime: (time) => {
    const { subtitles, activeLineIndex, abLoop, requestSeek, isSeeking, lastSeekTime } = get();
    
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
    
    const newIndex = subtitles.findIndex(line => time >= line.start && time <= line.end);
    
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
      set({ activeLineIndex: newIndex });
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
      isSeeking: true 
    });
  },
  setSeeking: (isSeeking) => set({ isSeeking }),
  setRecording: (isRecording) => set({ isRecording }),
  setShadowingResult: (result) => set({ shadowingResult: result }),
  toggleNativeCC: () => set(state => ({ isNativeCCOn: !state.isNativeCCOn })),
  setNativeCCLang: (lang) => set({ nativeCCLang: lang }),
  toggleCommunity: () => set(state => ({ isCommunityOn: !state.isCommunityOn })),
  
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
      set({ 
          sessionListeningSeconds: 0, 
          sessionShadowingCount: 0,
          sessionShadowingSeconds: 0
      });

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
              // Return failed data to store
              set(s => ({
                  sessionListeningSeconds: s.sessionListeningSeconds + payload.listening_seconds,
                  sessionShadowingCount: s.sessionShadowingCount + payload.shadowing_count,
                  sessionShadowingSeconds: s.sessionShadowingSeconds + payload.shadowing_seconds
              }));
          }
      } catch (err) {
          // Re-add on failure
          set(s => ({
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
            set({ [trackKey]: r.data.lines || [] } as any);
            if (trackKey === 's1Lines') {
                set({ subtitles: r.data.lines || [] });
            }
        } catch (e) { console.error(`Failed to fetch ${trackKey}`, e); }
    };

    if (newIds.s1 !== undefined) fetchTrack(updatedIds.s1, 's1Lines');
    if (newIds.s2 !== undefined) fetchTrack(updatedIds.s2, 's2Lines');
    if (newIds.s3 !== undefined) fetchTrack(updatedIds.s3, 's3Lines');
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

  deleteNote: (id) => set((state) => ({ 
      notes: state.notes.filter(n => n.id !== id) 
  })),
  updateNote: (id, content) => set((state) => ({
      notes: state.notes.map(n => n.id === id ? { ...n, content } : n)
  })),

  setLessonData: (data) => set((state) => {
    let newSettings = state.settings;
    if (data.settings_json) {
        try {
            // ROBUST PARSE: Never trust server-side strings
            const saved = typeof data.settings_json === 'string' 
                ? JSON.parse(data.settings_json) 
                : data.settings_json;
            
            if (saved && typeof saved === 'object') {
                newSettings = {
                    ...state.settings,
                    ...saved,
                    s1: { ...state.settings.s1, ...(saved.s1 || {}) },
                    s2: { ...state.settings.s2, ...(saved.s2 || {}) },
                    s3: { ...state.settings.s3, ...(saved.s3 || {}) },
                    notes: { ...state.settings.notes, ...(saved.notes || {}) }
                };
            }
        } catch (e) { 
            console.warn("Recovered from malformed settings_json in setLessonData", e); 
        }
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
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  fetchLessonData: async (id) => {
    const state = get();
    // 1. If we ALREADY have this lesson and it's loaded, don't reset. 
    // This prevents the 'black screen' flicker when hydrating from window data.
    if (state.lessonId === id && state.isLoaded && state.videoId) {
        // Just refresh notes/status in background if needed, but don't show loader
    } else {
        set({ 
          isLoaded: false, 
          lessonId: id, 
          videoId: null, 
          subtitles: [], 
          s1Lines: [], 
          s2Lines: [], 
          s3Lines: [], 
          activeLineIndex: -1,
          availableTracks: [] 
        });
    }
    
    try {
        const metaRes = await axios.get(`/api/subtitles/fetch/${id}`);
        // Safety: If lessonId changed during fetch, ignore this stale result
        if (get().lessonId !== id) return;

        const m = metaRes.data;
        
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
            fetchTrack(trackIds.s1),
            fetchTrack(trackIds.s2),
            fetchTrack(trackIds.s3),
            axios.get(`/api/ai/insights/${m.video_id}`).catch(() => ({ data: { insights: [] } }))
        ]);

        // Safety again after long Promise.all
        if (get().lessonId !== id) return;

        let finalSettings = get().settings;
        if (m.settings_json) {
            try {
                const saved = typeof m.settings_json === 'string' 
                    ? JSON.parse(m.settings_json) 
                    : m.settings_json;

                if (saved && typeof saved === 'object') {
                    finalSettings = {
                        ...get().settings,
                        ...saved,
                        s1: { ...get().settings.s1, ...(saved.s1 || {}) },
                        s2: { ...get().settings.s2, ...(saved.s2 || {}) },
                        s3: { ...get().settings.s3, ...(saved.s3 || {}) },
                        notes: { ...get().settings.notes, ...(saved.notes || {}) }
                    };
                }
            } catch (e) {
                console.warn("Recovered from malformed settings_json in fetchLessonData", e);
            }
        }

        set({ 
            lessonTitle: m.lesson_title,
            videoId: m.video_id,
            originalLang: m.metadata?.original_lang || 'ja',
            subtitles: l1,
            s1Lines: l1,
            s2Lines: l2,
            s3Lines: l3,
            availableTracks: m.available_tracks || [],
            trackIds,
            settings: finalSettings,
            isCompleted: m.is_completed || false,
            initialListeningSeconds: m.total_time_spent || 0,
            isLoaded: true // Success
        });

        if (aiRes.data) {
            set({
                aiInsights: aiRes.data.insights || [],
                aiStatus: aiRes.data.status || 'empty',
                aiProgress: {
                    processed: aiRes.data.processed_lines || 0,
                    total: aiRes.data.total_lines || 0
                },
                aiSummary: aiRes.data.overall_summary || null
            });
        }

        const notesRes = await axios.get(`/api/lesson/${id}/notes`);
        if (notesRes.data.notes && get().lessonId === id) {
            set({ notes: notesRes.data.notes });
        }
    } catch (err) {
        console.error("Fetch lesson failed", err);
        // On error, we still need to set isLoaded to true so the UI can show a fallback/error,
        // but we'll have videoId = null which should be handled by the UI.
        set({ isLoaded: true }); 
    }
  },

  completeLesson: async () => {
    const state = get();
    if (!state.lessonId) return;
    
    try {
        const response = await fetch(`/api/lesson/${state.lessonId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            set({ isCompleted: true });
        }
    } catch (e) {
        console.error("Failed to complete lesson", e);
    }
  },

  fetchNotes: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/lesson/${lessonId}/notes`);
        if (res.data.notes) {
            set({ notes: res.data.notes });
        }
    } catch (e) {
        console.error("Failed to fetch notes", e);
    }
  },

  setAutoNext: (isAutoNext) => set({ isAutoNext }),

  setMode: (mode) => set({ mode }),

  fetchShadowingStats: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/lesson/${lessonId}/shadowing-stats`);
        if (res.data.stats) {
            set({ shadowingStats: res.data.stats });
        }
    } catch (e) {
        console.error("Failed to fetch shadowing stats", e);
    }
  },

  setAIInsights: (data: any) => set({
    aiInsights: data.insights || [],
    aiStatus: data.status || 'empty',
    aiProgress: {
        processed: data.processed_lines || 0,
        total: data.total_lines || 0
    },
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
            if (existingIdx !== -1) {
                newInsights[existingIdx] = res.data.insight;
            } else {
                newInsights.push(res.data.insight);
            }
            set({ aiInsights: newInsights });
        }
    } catch (e) { 
        console.error("Failed to analyze line", e);
        throw e;
    }
  },

  skipNextSentence: () => {
    const { subtitles, currentTime, requestSeek } = get();
    // Find the current active sentence index
    const currentIndex = subtitles.findIndex(line => currentTime >= line.start && currentTime <= line.end);
    
    if (currentIndex !== -1 && currentIndex < subtitles.length - 1) {
      // If we are currently IN a sentence, jump to the START of the next one
      const targetLine = subtitles[currentIndex + 1];
      requestSeek(targetLine.start + 0.05, currentIndex + 1);
    } else {
      // If we are in a gap between sentences, find the first one that starts after us
      const nextIdx = subtitles.findIndex(line => line.start > currentTime + 0.05);
      if (nextIdx !== -1) {
        requestSeek(subtitles[nextIdx].start + 0.05, nextIdx);
      }
    }
  },

  skipPrevSentence: () => {
    const { subtitles, currentTime, requestSeek } = get();
    // 1. Find the current/last subtitle
    // We look for the subtitle that ends closest to BEFORE current time, 
    // or the one currently active.
    const currentIndex = subtitles.findIndex(line => currentTime >= line.start && currentTime <= line.end);
    
    if (currentIndex !== -1) {
      const currentLine = subtitles[currentIndex];
      // If we are more than 1s into the current sentence, jump to its start
      if (currentTime - currentLine.start > 1.2) {
        requestSeek(currentLine.start + 0.05, currentIndex);
      } else if (currentIndex > 0) {
        // Otherwise jump to the previous sentence
        requestSeek(subtitles[currentIndex - 1].start + 0.05, currentIndex - 1);
      }
    } else {
      // If not in a sentence, find the one immediately before current time
      // findIndex on reversed copy is tricky, let's just use a loop for clarity if needed or simpler find logic
      const rSubtitles = [...subtitles].reverse();
      const prevLine = rSubtitles.find(line => line.start < currentTime - 0.5);
      if (prevLine) {
         const originalIndex = subtitles.findIndex(l => l.start === prevLine.start);
         requestSeek(prevLine.start + 0.05, originalIndex);
      }
    }
  }
}));
