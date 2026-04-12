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
    s1: number | null;
    s2: number | null;
    s3: number | null;
  };

  abLoop: {
    start: number | null;
    end: number | null;
    enabled: boolean;
  };
  lastSeekTime: number;
  isSeeking: boolean; // NEW: Lock for navigation
  
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
  setTrackSettings: (track: 's1' | 's2' | 's3', settings: Partial<TrackSettings>) => void;
  setAvailableTracks: (tracks: any[]) => void;
  setTrackIds: (ids: Partial<PlayerState['trackIds']>) => void;
  setAbLoop: (loop: Partial<PlayerState['abLoop']>) => void;
  setNotes: (notes: Note[]) => void;
  setNoteSettings: (settings: Partial<PlayerState['settings']['notes']>) => void;
  addNote: (note: Note) => void;
  deleteNote: (id: number) => void;
  fetchLessonData: (id: number) => Promise<void>;
  completeLesson: () => Promise<void>;
  setSidebarWidth: (width: number) => void;
}

const defaultTrackSettings = (fontSize: number, color: string, opacity: number, position: number): TrackSettings => ({
    fontSize, color, bgColor: '#000000', bgOpacity: opacity, enabled: true, position
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
  
  lessonId: null,
  lessonTitle: null,
  videoId: null,
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

  availableTracks: [],
  trackIds: { s1: null, s2: null, s3: null },
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
        theme: 'classic'
    }
  },

  setCurrentTime: (time) => {
    const { subtitles, activeLineIndex, abLoop, requestSeek, isSeeking, lastSeekTime } = get();
    
    // Safety 1: Strict Seeking Lock (Block Poller)
    if (isSeeking || (Date.now() - lastSeekTime < 1000)) {
      set({ currentTime: time });
      return;
    }

    set({ currentTime: time });
    
    if (abLoop.enabled) {
      if (abLoop.start !== null && abLoop.end !== null && time >= abLoop.end) {
        requestSeek(abLoop.start);
      }
    }
    
    const newIndex = subtitles.findIndex(line => time >= line.start && time <= line.end);
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
    const { subtitles, activeLineIndex } = get();
    // Use directly provided index OR find it
    const targetIndex = newIndex !== undefined ? newIndex : subtitles.findIndex(l => time >= l.start && time <= l.end);
    
    set({ 
      seekToTime: time, 
      lastSeekTime: Date.now(),
      currentTime: time,
      activeLineIndex: targetIndex !== -1 ? targetIndex : activeLineIndex,
      isSeeking: true // Lock Poller during transport
    });
  },
  setSeeking: (isSeeking) => set({ isSeeking }),
  setRecording: (isRecording) => set({ isRecording }),
  setShadowingResult: (result) => set({ shadowingResult: result }),
  
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

    const fetchTrack = async (tid: number | null, trackKey: 's1Lines' | 's2Lines' | 's3Lines') => {
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

  setLessonData: (data) => set((state) => {
    let newSettings = state.settings;
    if (data.settings_json) {
        try {
            const saved = JSON.parse(data.settings_json);
            newSettings = {
                ...state.settings,
                ...saved,
                s1: { ...state.settings.s1, ...(saved.s1 || {}) },
                s2: { ...state.settings.s2, ...(saved.s2 || {}) },
                s3: { ...state.settings.s3, ...(saved.s3 || {}) },
                notes: { ...state.settings.notes, ...(saved.notes || {}) }
            };
        } catch (e) { console.error("Failed to parse settings_json", e); }
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
    if (state.lessonId !== id) {
        set({ isLoaded: false, subtitles: [], videoId: null, lessonId: id, availableTracks: [] });
    }
    
    try {
        const metaRes = await axios.get(`/api/subtitles/fetch/${id}`);
        const m = metaRes.data;
        
        const trackIds = {
            s1: m.metadata?.s1_track_id || m.track_id,
            s2: m.metadata?.s2_track_id || null,
            s3: m.metadata?.s3_track_id || null
        };

        const fetchTrack = async (tid: number | null) => {
            if (!tid) return [];
            try {
                const r = await axios.get(`/api/subtitles/fetch/${id}`, { params: { track_id: tid } });
                return r.data.lines || [];
            } catch (e) { return []; }
        };

        const [l1, l2, l3] = await Promise.all([
            fetchTrack(trackIds.s1),
            fetchTrack(trackIds.s2),
            fetchTrack(trackIds.s3)
        ]);

        let finalSettings = state.settings;
        if (m.settings_json) {
            try {
                const saved = JSON.parse(m.settings_json);
                finalSettings = {
                    ...state.settings,
                    ...saved,
                    s1: { ...state.settings.s1, ...(saved.s1 || {}) },
                    s2: { ...state.settings.s2, ...(saved.s2 || {}) },
                    s3: { ...state.settings.s3, ...(saved.s3 || {}) },
                    notes: { ...state.settings.notes, ...(saved.notes || {}) }
                };
            } catch (e) {}
        }

        set({ 
            lessonId: id,
            lessonTitle: m.lesson_title,
            videoId: m.video_id,
            subtitles: l1,
            s1Lines: l1,
            s2Lines: l2,
            s3Lines: l3,
            availableTracks: m.available_tracks || [],
            trackIds,
            settings: finalSettings,
            isCompleted: m.is_completed || false,
            isLoaded: true
        });

        const notesRes = await axios.get(`/api/lesson/${id}/notes`);
        if (notesRes.data.notes) set({ notes: notesRes.data.notes });
    } catch (err) {
        console.error("Fetch lesson failed", err);
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
  }
}));
