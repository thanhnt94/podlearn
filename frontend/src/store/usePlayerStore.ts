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
  activeSidebarTab: string;
  setActiveSidebarTab: (tab: string) => void;
  timelineSub: 'transcript' | 'notes' | 'social';
  setTimelineSub: (sub: 'transcript' | 'notes' | 'social') => void;
  practiceSub: 'shadowing' | 'dictation' | 'mastery' | 'ai';
  setPracticeSub: (sub: 'shadowing' | 'dictation' | 'mastery' | 'ai') => void;
  isEditingCurated: boolean;
  setEditingCurated: (editing: boolean) => void;
  draftCuratedContent: PlayerState['curatedContent'];
  setDraftCuratedContent: (data: Partial<PlayerState['curatedContent']>) => void;
  
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
  sourceTrackId: number | null;
  setSourceTrackId: (id: number | null) => void;
  videoGlossary: any[];
  isEditingSegmentation: boolean;
  aiInsights: any[];
  aiStatus: string;
  analysisSource: 'auto' | 'curated' | 'ai_pack' | 'track';
  targetLang: string;
  setTargetLang: (lang: string) => void;
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
  
  curatedContent: { id: string, title: string, content: string }[];
  fetchCuratedContent: () => Promise<void>;
  updateCuratedContent: (data: PlayerState['curatedContent']) => Promise<void>;
  
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
    lemma?: string,
    lemma_override?: string
  }[];

  // New states for simplified workflow
  autoSegmentationEnabled: boolean;
  preferredDictionary: 'mazii_offline' | 'jisho' | 'google';
  rawJsonInput: string;
  
  setAutoSegmentationEnabled: (enabled: boolean) => void;
  setPreferredDictionary: (dict: PlayerState['preferredDictionary']) => void;
  preferredSystemDictId: string | null;
  setPreferredSystemDictId: (id: string | null) => void;
  setRawJsonInput: (input: string) => void;
  showFurigana: boolean;
  lastAnalyzedIndex: number;
  useOfflineDict: boolean;
  setUseOfflineDict: (use: boolean) => void;
  savedVocab: any[];
  
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
  setAnalysisSource: (source: 'auto' | 'curated' | 'ai_pack' | 'track', trackId?: number | null) => void;
  fetchVideoGlossary: () => Promise<void>;
  toggleEditingSegmentation: (val?: boolean) => void;
  setAvailableTracks: (tracks: any[]) => void;
  setTrackIds: (ids: Partial<PlayerState['trackIds']>) => void;
  setAbLoop: (loop: Partial<PlayerState['abLoop']>) => void;
  setNotes: (notes: Note[]) => void;
  setNoteSettings: (settings: Partial<PlayerState['settings']['notes']>) => void;
  setSyncOffset: (offset: number) => void;
  addNote: (timestamp: number, content: string) => Promise<void>;
  appendNote: (note: Note) => void;
  deleteNote: (id: number) => Promise<void>;
  updateNote: (id: number, content: string) => Promise<void>;
  importAnalysis: (json: any) => Promise<void>;
  importAIPack: (srtFile: File, jsonFile: File, langCode: string, name: string) => Promise<any>;
  importDictionary: (json: any) => Promise<void>;
  importNotes: (notes: Note[]) => Promise<void>;
  fetchLessonData: (id: number) => Promise<void>;
  completeLesson: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  fetchVocab: () => Promise<void>;
  addVocab: (word: string, reading: string, meaning: string) => Promise<void>;
  removeVocab: (word: string) => Promise<void>;
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
  
  // System Dictionary Actions
  globalDictionaries: any[];
  setGlobalDictionaries: (dicts: any[]) => void;
  fetchSystemDictionaries: () => Promise<void>;
  createSystemDictionary: (name: string, src: string, target: string) => Promise<any>;
  fetchDictionaryItems: (dictId: string) => Promise<any[]>;
  importToSystemDictionary: (dictId: string, jsonInput: any) => Promise<void>;
  updateGlossaryItem: (itemId: number, data: any) => Promise<void>;
  deleteGlossaryItem: (itemId: number, dictId: string) => Promise<void>;

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

  // New Management UI State
  showDictManager: boolean;
  setShowDictManager: (show: boolean) => void;
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

  curatedContent: [],
  fetchCuratedContent: async () => {
    const { videoId } = get();
    if (!videoId) return;
    try {
        const res = await axios.get(`/api/content/curated/${videoId}`);
        set({ curatedContent: res.data });
    } catch (e) {}
  },
  updateCuratedContent: async (data) => {
    const { videoId } = get();
    if (!videoId) return;
    try {
        // 'data' should be the full array of sections
        await axios.patch(`/api/content/curated/${videoId}`, { sections: data });
        set({ curatedContent: data as any });
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
  videoGlossary: [],
  sourceTrackId: null,
  setSourceTrackId: (id) => set({ sourceTrackId: id }),
  isEditingSegmentation: false,
  analysisSource: 'auto',
  targetLang: 'vi',
  setTargetLang: (lang) => set({ targetLang: lang }),
  showFurigana: true,
  lastAnalyzedIndex: -1,
  hasTokens: false,
  
  globalDictionaries: [],
  setGlobalDictionaries: (dicts) => set({ globalDictionaries: dicts }),

  fetchSystemDictionaries: async () => {
    try {
      const res = await axios.get('/api/study/dictionaries/system');
      set({ globalDictionaries: res.data });
    } catch (e) {
      console.error("Failed to fetch system dictionaries", e);
    }
  },

  createSystemDictionary: async (name, src, target) => {
    try {
      const res = await axios.post('/api/study/dictionaries/system', { name, src, target });
      get().fetchSystemDictionaries();
      return res.data;
    } catch (e) {
      console.error("Failed to create system dictionary", e);
      throw e;
    }
  },

  fetchDictionaryItems: async (dictPath) => {
    try {
      const res = await axios.get(`/api/study/dictionaries/items?id=${encodeURIComponent(dictPath)}`);
      return res.data;
    } catch (e) {
      console.error("Failed to fetch dictionary items", e);
      return [];
    }
  },

  importToSystemDictionary: async (dictPath, jsonInput) => {
    let dataToSubmit = [];
    try {
      if (typeof jsonInput !== 'string') {
        dataToSubmit = Array.isArray(jsonInput) ? jsonInput : [jsonInput];
      } else {
        const trimmed = jsonInput.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed);
          dataToSubmit = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          const wrapped = JSON.parse(`[${trimmed}]`);
          dataToSubmit = Array.isArray(wrapped) ? wrapped : [wrapped];
        }
      }
      await axios.post(`/api/study/dictionaries/import`, { id: dictPath, items: dataToSubmit });
      get().fetchSystemDictionaries();
    } catch (e) {
      console.error("Import to system dictionary failed", e);
      throw e;
    }
  },

  updateGlossaryItem: async (_itemId, data) => {
    try {
      // data includes dict_id (path), item_id, term, reading, meaning
      await axios.patch(`/api/study/glossary/item`, data);
    } catch (e) {
      console.error("Update glossary item failed", e);
      throw e;
    }
  },

  deleteGlossaryItem: async (itemId, dictId) => {
    try {
      await axios.delete(`/api/study/glossary/item`, { data: { item_id: itemId, dict_id: dictId } });
    } catch (e) {
      console.error("Delete glossary item failed", e);
      throw e;
    }
  },

  showDictManager: false,
  setShowDictManager: (show) => set({ showDictManager: show }),
  isManualAnalysis: false,
  useOfflineDict: true,
  savedVocab: [],
  isVocabStudioOpen: false,

  autoSegmentationEnabled: true,
  preferredDictionary: 'mazii_offline',
  preferredSystemDictId: null,
  setPreferredSystemDictId: (id) => set({ preferredSystemDictId: id }),
  rawJsonInput: '',

  setVocabStudioOpen: (open) => set({ isVocabStudioOpen: open }),
  activeSidebarTab: 'Overview',
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  timelineSub: 'transcript',
  setTimelineSub: (sub) => set({ timelineSub: sub }),
  practiceSub: 'shadowing',
  setPracticeSub: (sub) => set({ practiceSub: sub }),
  isEditingCurated: false,
  setEditingCurated: (editing) => set({ isEditingCurated: editing }),
  draftCuratedContent: [],
  setDraftCuratedContent: (data) => set({ draftCuratedContent: data as any }),
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
        const res = await axios.get(`/api/engagement/comments/${video_id}`);
        set({ comments: res.data });
    } catch (err) {}
  },
  addComment: async (video_id, content, timestamp) => {
    try {
        const res = await axios.post(`/api/engagement/comments/${video_id}`, { content, video_timestamp: timestamp });
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
          const res = await axios.get(`/api/content/subtitles/available/${lessonId}`);
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
    importAnalysis: async (json: any) => {
        const { lessonId, checkScanStatus } = get();
        if (!lessonId) return;
        try {
            await axios.post(`/api/study/lesson/${lessonId}/analysis/import`, json);
            await checkScanStatus();
            // Refresh current line analysis if active
            const { activeLineIndex, subtitles, originalLang } = get();
            if (activeLineIndex !== -1 && subtitles[activeLineIndex]) {
                await get().fetchAnalyzedWords(subtitles[activeLineIndex].text, originalLang || 'ja');
            }
        } catch (err) {
            console.error("Analysis import failed:", err);
            throw err;
        }
    },

    importAIPack: async (srtFile: File, jsonFile: File, langCode: string, name: string) => {
        const { lessonId, fetchAvailableTracks, checkScanStatus } = get();
        if (!lessonId) return;
        try {
            const formData = new FormData();
            formData.append('srt_file', srtFile);
            formData.append('json_file', jsonFile);
            formData.append('language_code', langCode);
            formData.append('name', name);

            const res = await axios.post(`/api/study/lesson/${lessonId}/import-ai-pack`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            await fetchAvailableTracks();
            await checkScanStatus();
            // Refresh current line analysis if active
            const { activeLineIndex, subtitles, originalLang } = get();
            if (activeLineIndex !== -1 && subtitles[activeLineIndex]) {
                await get().fetchAnalyzedWords(subtitles[activeLineIndex].text, originalLang || 'ja');
            }
            return res.data;
        } catch (err) {
            console.error("AI Pack import failed:", err);
            throw err;
        }
    },

    importDictionary: async (jsonInput: any) => {
        const { lessonId, fetchAnalyzedWords, originalLang } = get();
        if (!lessonId) return;
        
        let dataToSubmmit: any[] = [];
        
        try {
            // If it's already an array or object from a file
            if (typeof jsonInput !== 'string') {
                dataToSubmmit = Array.isArray(jsonInput) ? jsonInput : [jsonInput];
            } else {
                // If it's a string from a paste area
                const trimmed = jsonInput.trim();
                if (!trimmed) return;
                
                try {
                    const parsed = JSON.parse(trimmed);
                    dataToSubmmit = Array.isArray(parsed) ? parsed : [parsed];
                } catch (parseErr) {
                    // Try to fix missing brackets if it's a list of objects like {..},{..}
                    try {
                        const wrapped = JSON.parse(`[${trimmed}]`);
                        dataToSubmmit = Array.isArray(wrapped) ? wrapped : [wrapped];
                    } catch (innerErr) {
                        console.error("Failed to parse dictionary JSON:", trimmed);
                        throw new Error("Định dạng JSON không hợp lệ. Hãy kiểm tra lại dấu ngoặc.");
                    }
                }
            }

            await axios.post(`/api/study/lesson/${lessonId}/dictionary/import`, {
                items: dataToSubmmit,
                lang: originalLang || 'ja',
                target_lang: get().targetLang || 'vi'
            });
            
            // Refresh analysis for current line to show new definitions
            const { activeLineIndex, subtitles } = get();
            if (activeLineIndex !== -1 && subtitles[activeLineIndex]) {
                await fetchAnalyzedWords(subtitles[activeLineIndex].text, originalLang || 'ja');
            }
        } catch (err: any) {
            console.error("Dictionary import failed:", err);
            throw err;
        }
    },
  setAbLoop: (newLoop) => set((state) => ({ abLoop: { ...state.abLoop, ...newLoop } })),
  setNoteSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, notes: { ...state.settings.notes, ...newSettings } } })),
  setSyncOffset: (offset) => set((state) => ({ settings: { ...state.settings, syncOffset: offset } })),
  setNotes: (notes) => set({ notes }),
  setLessonData: (data) => set((state) => {
    let newSettings = { ...state.settings };
    if (data.settings) newSettings = { ...newSettings, ...data.settings };
    
    // Extract vocab-specific settings if they exist in the settings object
    const vocabSettings: any = {};
    if (data.settings?.sourceTrackId !== undefined) vocabSettings.sourceTrackId = data.settings.sourceTrackId;
    if (data.settings?.autoSegmentationEnabled !== undefined) vocabSettings.autoSegmentationEnabled = data.settings.autoSegmentationEnabled;
    if (data.settings?.preferredDictionary !== undefined) vocabSettings.preferredDictionary = data.settings.preferredDictionary;
    if (data.settings?.useOfflineDict !== undefined) vocabSettings.useOfflineDict = data.settings.useOfflineDict;
    if (data.settings?.analysisSource !== undefined) vocabSettings.analysisSource = data.settings.analysisSource;

    return { 
        ...state,
        ...vocabSettings,
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
        get().fetchCuratedContent();
        get().fetchNotes();
        get().fetchVocab();
    } catch (e) { set({ isLoaded: false }); }
  },
  completeLesson: async () => {}, 
  fetchNotes: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/study/lesson/${lessonId}/notes`);
        set({ notes: res.data });
    } catch (e) {}
  },
  addNote: async (timestamp: number, content: string) => {
    const { lessonId, notes } = get();
    if (!lessonId) return;
    try {
        const res = await axios.post(`/api/study/lesson/${lessonId}/notes`, { timestamp, content });
        if (res.data.success) {
            set({ notes: [...notes, res.data.note] });
        }
    } catch (e) { throw e; }
  },
  appendNote: (note: Note) => set((state) => ({ notes: [...state.notes, note] })),
  updateNote: async (noteId: number, content: string) => {
    const { notes } = get();
    try {
        const res = await axios.patch(`/api/study/notes/${noteId}`, { content });
        if (res.data.success) {
            set({ notes: notes.map(n => n.id === noteId ? { ...n, content } : n) });
        }
    } catch (e) {}
  },
  importNotes: async (notesList) => {
    const { lessonId, notes } = get();
    if (!lessonId || !notesList.length) return;
    try {
        const res = await axios.post(`/api/study/lesson/${lessonId}/notes/batch`, { notes: notesList });
        if (res.data.success) {
            set({ 
                notes: [...notes, ...res.data.notes].sort((a, b) => a.timestamp - b.timestamp) 
            });
        }
    } catch (err) { throw err; }
  },
  deleteNote: async (noteId: number) => {
    const { notes } = get();
    try {
        const res = await axios.delete(`/api/study/notes/${noteId}`);
        if (res.data.success) {
            set({ notes: notes.filter(n => n.id !== noteId) });
        }
    } catch (e) {}
  },
  fetchVocab: async () => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        const res = await axios.get(`/api/study/vocab/list/${lessonId}`);
        set({ savedVocab: res.data.vocab });
    } catch (e) {}
  },
  addVocab: async (word: string, reading: string, meaning: string) => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        await axios.post('/api/study/vocab/add', { lesson_id: lessonId, word, reading, meaning });
        get().fetchVocab();
    } catch (e) {}
  },
  removeVocab: async (word: string) => {
    const { lessonId } = get();
    if (!lessonId) return;
    try {
        await axios.delete('/api/study/vocab/remove', { data: { lesson_id: lessonId, word } });
        get().fetchVocab();
    } catch (e) {}
  },
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
           const { 
               analysisSource, sourceTrackId, lessonId, activeLineIndex,
               autoSegmentationEnabled, useOfflineDict, targetLang,
               preferredSystemDictId 
           } = get();
           const res = await axios.post('/api/study/vocab/analyze', { 
               text, 
               original_lang: lang,
               target_lang: targetLang,
               dict_id: preferredSystemDictId,
               lesson_id: lessonId,
              line_index: activeLineIndex,
              source: analysisSource,
              track_id: sourceTrackId,
              auto_segmentation: autoSegmentationEnabled,
              use_offline: useOfflineDict
          });
          set({ analyzedWords: res.data });
      } catch (e) {}
  },
  checkScanStatus: async (id) => {
      const lid = id || get().lessonId;
      if (!lid) return;
      try {
          await axios.get(`/api/study/vocab/scan-status/${lid}`);
          // We don't need hasTokens anymore, the UI logic was changed
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
  saveTrackShifts: async () => {},
  setAnalysisSource: (source, trackId = null) => {
    const { s1Lines, s2Lines, s3Lines } = get();
    let newSubtitles = s1Lines;
    if (trackId) {
        // Find which lines array corresponds to this trackId
        if (trackId === (get().trackIds.s1)) newSubtitles = s1Lines;
        else if (trackId === (get().trackIds.s2)) newSubtitles = s2Lines;
        else if (trackId === (get().trackIds.s3)) newSubtitles = s3Lines;
    }
    
    set({ 
        analysisSource: source, 
        sourceTrackId: trackId,
        subtitles: newSubtitles
    });
    
    // Refresh analysis if active
    const { activeLineIndex, originalLang } = get();
    if (activeLineIndex !== -1 && newSubtitles[activeLineIndex]) {
        get().fetchAnalyzedWords(newSubtitles[activeLineIndex].text, originalLang || 'ja');
    }
  },
  fetchVideoGlossary: async () => {
        const { lessonId } = get();
        if (!lessonId) return;
        try {
            const response = await axios.get(`/api/study/video/glossary/${lessonId}`);
            set({ videoGlossary: response.data.glossary || [] });
        } catch (err) { console.error("Failed to fetch glossary", err); }
    },

    toggleEditingSegmentation: (val) => {
        set((state) => ({ 
            isEditingSegmentation: val !== undefined ? val : !state.isEditingSegmentation 
        }));
    },
    setAutoSegmentationEnabled: (enabled) => set({ autoSegmentationEnabled: enabled }),
    setPreferredDictionary: (dict) => set({ preferredDictionary: dict }),
    setUseOfflineDict: (use) => set({ useOfflineDict: use }),
    setRawJsonInput: (input) => set({ rawJsonInput: input }),
}));
