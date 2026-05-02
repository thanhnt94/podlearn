import { create } from 'zustand';
import axios from 'axios';

interface User {
    id: number;
    username: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    role: 'free' | 'vip' | 'admin';
    is_admin: boolean;
    is_vip: boolean;
}

interface AppState {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    lessons: any[];
    playlists: any[];
    sets: any[];
    badges: any[];
    newlyEarnedBadge: any | null;
    stats: any;
    notifications: any[];
    communityVideos: any[];
    
    // Actions
    login: (credentials: any) => Promise<boolean>;
    logout: () => Promise<void>;
    fetchDashboard: () => Promise<void>;
    checkNewBadges: () => Promise<void>;
    clearCelebration: () => void;
    deleteLesson: (id: number) => Promise<void>;
    deleteVideoGlobal: (id: string | number) => Promise<void>;
    toggleVideoVisibility: (id: string | number, visible: any) => Promise<void>;
    
    // Playlist Actions
    fetchPlaylists: () => Promise<void>;
    createPlaylist: (name: string) => Promise<boolean>;
    deletePlaylist: (id: number) => Promise<void>;
    addVideoToPlaylist: (playlistId: number, videoId: string | number) => Promise<void>;
    removeVideoFromPlaylist: (playlistId: number, videoId: string | number) => Promise<void>;
    
    // Notifications
    markNotificationRead: (id: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    user: null,
    isLoggedIn: false,
    isLoading: true,
    lessons: [],
    playlists: [],
    sets: [],
    badges: [],
    newlyEarnedBadge: null,
    stats: null,
    notifications: [],
    communityVideos: [],

    login: async (credentials) => {
        try {
            const res = await axios.post('/api/identity/login', credentials);
            const { access_token, user } = res.data;
            localStorage.setItem('access_token', access_token);
            set({ user, isLoggedIn: true });
            get().fetchDashboard();
            return true;
        } catch (e) {
            console.error("Login failed", e);
            return false;
        }
    },

    logout: async () => {
        try {
            await axios.post('/api/identity/logout').catch(() => {});
        } finally {
            localStorage.removeItem('access_token');
            set({ user: null, isLoggedIn: false, lessons: [], stats: null });
            window.location.href = '/';
        }
    },

    fetchDashboard: async () => {
        if (!localStorage.getItem('access_token')) {
            set({ isLoggedIn: false, isLoading: false });
            return;
        }

        set({ isLoading: true });
        try {
            const meRes = await axios.get('/api/identity/me');
            if (meRes.data.logged_in) {
                set({ user: meRes.data.user, isLoggedIn: true });
            } else {
                localStorage.removeItem('access_token');
                set({ user: null, isLoggedIn: false, isLoading: false });
                return;
            }

            const dashRes = await axios.get('/api/study/dashboard/init');
            const dashData = dashRes.data || {};
            set({
                lessons: Array.isArray(dashData.lessons) ? dashData.lessons : [],
                stats: dashData.stats || {},
                notifications: Array.isArray(dashData.notifications) ? dashData.notifications : [],
                communityVideos: Array.isArray(dashData.community_videos) ? dashData.community_videos : [],
                playlists: Array.isArray(dashData.playlists) ? dashData.playlists : (Array.isArray(dashData.sets) ? dashData.sets : []),
                sets: Array.isArray(dashData.sets) ? dashData.sets : [],
                badges: Array.isArray(dashData.badges) ? dashData.badges : [],
                isLoading: false
            });
        } catch (e) {
            console.error("Dashboard fetch failed", e);
            set({ isLoading: false });
        }
    },

    checkNewBadges: async () => {
        try {
            const res = await axios.get('/api/gamification/badges/check');
            if (res.data.new_badge) {
                set({ newlyEarnedBadge: res.data.new_badge });
            }
        } catch (e) {}
    },

    clearCelebration: () => set({ newlyEarnedBadge: null }),

    deleteLesson: async (id) => {
        try {
            await axios.delete(`/api/study/lesson/${id}`);
            set(state => ({ lessons: state.lessons.filter(l => l.id !== id) }));
        } catch (e) {}
    },

    deleteVideoGlobal: async (id) => {
        try {
            await axios.delete(`/api/content/video/${id}`);
            get().fetchDashboard();
        } catch (e) {}
    },

    toggleVideoVisibility: async (id, visibility) => {
        try {
            await axios.patch(`/api/content/video/${id}/visibility`, { visibility });
            get().fetchDashboard();
        } catch (e) {}
    },

    fetchPlaylists: async () => {
        try {
            const res = await axios.get('/api/study/playlists');
            // Support both { playlists: [...] } and direct array [...]
            const data = res.data;
            const playlists = Array.isArray(data) ? data : (data?.playlists || []);
            set({ playlists: Array.isArray(playlists) ? playlists : [] });
        } catch (e) {
            console.error("Fetch playlists failed", e);
            set({ playlists: [] });
        }
    },

    createPlaylist: async (name) => {
        try {
            await axios.post('/api/study/playlists', { name });
            get().fetchPlaylists();
            return true;
        } catch (e) {
            return false;
        }
    },

    deletePlaylist: async (id) => {
        try {
            await axios.delete(`/api/study/playlists/${id}`);
            set(state => ({ playlists: state.playlists.filter(p => p.id !== id) }));
        } catch (e) {}
    },

    addVideoToPlaylist: async (playlistId, videoId) => {
        try {
            await axios.post(`/api/study/playlists/${playlistId}/videos`, { video_id: videoId });
            get().fetchPlaylists();
        } catch (e) {}
    },

    removeVideoFromPlaylist: async (playlistId, videoId) => {
        try {
            await axios.delete(`/api/study/playlists/${playlistId}/videos/${videoId}`);
            get().fetchPlaylists();
        } catch (e) {}
    },

    markNotificationRead: async (id) => {
        try {
            await axios.post(`/api/study/notifications/${id}/read`);
            set(state => ({ notifications: state.notifications.filter(n => n.id !== id) }));
        } catch (e) {}
    }
}));
