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
    sender_name: string;
    video_title: string;
    created_at: string;
}

interface AppState {
    lessons: Lesson[];
    communityVideos: Lesson[];
    playlists: Playlist[];
    stats: {
        current_streak: number;
        longest_streak: number;
        completed_count: number;
        total_lessons: number;
        total_time_seconds: number;
    };
    notifications: Notification[];
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
}

export const useAppStore = create<AppState>((set, get) => ({
    lessons: [],
    communityVideos: [],
    playlists: [],
    stats: { current_streak: 0, longest_streak: 0, completed_count: 0, total_lessons: 0, total_time_seconds: 0 },
    notifications: [],
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
                isLoading: false
            });
            get().fetchPlaylists();
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

    createPlaylist: async (name, description) => {
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

    deletePlaylist: async (id) => {
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

    addVideoToPlaylist: async (playlistId, videoId) => {
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

    removeVideoFromPlaylist: async (playlistId, videoId) => {
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
    }
}));
