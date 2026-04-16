import { create } from 'zustand';
import axios from 'axios';

interface Video {
    id: number;
    title: string;
    channel_title?: string;
    thumbnail_url: string;
    duration_seconds: number;
    owner_name: string;
    visibility: string;
}

interface Lesson {
    id: number;
    video: Video;
    time_spent: number;
    is_completed: boolean;
    last_accessed: string | null;
}

interface Playlist {
    id: number;
    name: string;
    description: string;
    video_count: number;
    created_at: string;
}

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link_url?: string;
}

interface Badge {
    id: number;
    name: string;
    description: string;
    icon_name: string;
    category: string;
    is_earned: boolean;
    earned_at?: string;
}

interface AppState {
    lessons: Lesson[];
    communityVideos: Lesson[];
    playlists: Playlist[];
    sets: any[];
    stats: {
        current_streak: number;
        longest_streak: number;
        completed_count: number;
        total_lessons: number;
        total_time_seconds: number;
    };
    notifications: Notification[];
    badges: Badge[];
    newlyEarnedBadge: Badge | null; // For the celebration modal
    isLoading: boolean;
    
    // Actions
    fetchDashboard: () => Promise<void>;
    respondToInvite: (id: number, action: 'accept' | 'reject') => Promise<void>;
    
    // Playlist Actions
    fetchPlaylists: () => Promise<void>;
    createPlaylist: (name: string, description?: string) => Promise<boolean>;
    deletePlaylist: (id: number) => Promise<void>;
    addVideoToPlaylist: (playlistId: number, videoId: number) => Promise<void>;
    removeVideoFromPlaylist: (playlistId: number, videoId: number) => Promise<void>;
    
    // Notification & Gamification Actions
    fetchNotifications: () => Promise<void>;
    markNotificationRead: (id: number) => Promise<void>;
    fetchBadges: () => Promise<void>;
    checkNewBadges: () => Promise<void>;
    clearCelebration: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    lessons: [],
    communityVideos: [],
    playlists: [],
    sets: [],
    stats: { current_streak: 0, longest_streak: 0, completed_count: 0, total_lessons: 0, total_time_seconds: 0 },
    notifications: [],
    badges: [],
    newlyEarnedBadge: null,
    isLoading: true,

    fetchDashboard: async () => {
        set({ isLoading: true });
        try {
            const res = await axios.get('/api/dashboard/init');
            set({
                lessons: res.data.lessons,
                communityVideos: res.data.community_videos,
                stats: res.data.stats,
                notifications: res.data.notifications,
                sets: res.data.sets || [],
                isLoading: false
            });
            get().fetchPlaylists();
            get().fetchNotifications();
            get().fetchBadges();
        } catch (err) {
            console.error("Dashboard fetch failed", err);
            set({ isLoading: false });
        }
    },

    fetchPlaylists: async () => {
        try {
            const res = await axios.get('/api/playlists');
            set({ playlists: res.data.playlists });
        } catch (err) {
            console.error("Playlists fetch failed", err);
        }
    },

    createPlaylist: async (name: string, description?: string) => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post('/api/playlists', { name, description }, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            get().fetchPlaylists();
            return true;
        } catch (err) {
            console.error("Playlist creation failed", err);
            return false;
        }
    },

    deletePlaylist: async (id: number) => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.delete(`/api/playlists/${id}`, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            set({ playlists: get().playlists.filter(p => p.id !== id) });
        } catch (err) {
            console.error("Playlist deletion failed", err);
        }
    },

    addVideoToPlaylist: async (playlistId: number, videoId: number) => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post(`/api/playlists/${playlistId}/videos`, { video_id: videoId }, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            get().fetchPlaylists();
        } catch (err) {
            console.error("Add video to playlist failed", err);
        }
    },

    removeVideoFromPlaylist: async (playlistId: number, videoId: number) => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.delete(`/api/playlists/${playlistId}/videos/${videoId}`, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            get().fetchPlaylists();
        } catch (err) {
            console.error("Remove video from playlist failed", err);
        }
    },

    respondToInvite: async (id, action) => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post(`/api/share/${id}/respond`, { action }, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            get().fetchDashboard(); // Refresh
        } catch (err) {
            console.error("Invite response failed", err);
        }
    },

    fetchNotifications: async () => {
        try {
            const res = await axios.get('/api/notifications');
            set({ notifications: res.data });
        } catch (err) { console.error("Fetch notifications failed", err); }
    },

    markNotificationRead: async (id) => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post(`/api/notifications/${id}/read`, {}, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            set(state => ({
                notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
            }));
        } catch (err) { console.error("Mark read failed", err); }
    },

    fetchBadges: async () => {
        try {
            const res = await axios.get('/api/gamification/badges');
            set({ badges: res.data.badges });
        } catch (err) { console.error("Fetch badges failed", err); }
    },

    checkNewBadges: async () => {
        try {
            const data = (window as any).__PODLEARN_DATA__;
            const res = await axios.post('/api/gamification/check-badges', {}, {
                headers: { 'X-CSRF-Token': data.csrf_token }
            });
            if (res.data.new_badges && res.data.new_badges.length > 0) {
                // For now just show the first one if multiple
                set({ newlyEarnedBadge: res.data.new_badges[0] });
                get().fetchBadges();
                get().fetchNotifications();
            }
        } catch (err) { console.error("Check badges failed", err); }
    },

    clearCelebration: () => set({ newlyEarnedBadge: null })
}));
