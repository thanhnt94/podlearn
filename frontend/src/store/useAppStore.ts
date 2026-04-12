import { create } from 'zustand';
import axios from 'axios';

interface Lesson {
    id: number;
    video: {
        id: number;
        title: string;
        thumbnail_url: string;
        duration_seconds: number;
        owner_name: string;
        visibility: string;
    };
    time_spent: number;
    is_completed: boolean;
    last_accessed: string | null;
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
    sets: any[];
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
}

export const useAppStore = create<AppState>((set, get) => ({
    lessons: [],
    communityVideos: [],
    sets: [],
    stats: { current_streak: 0, longest_streak: 0, completed_count: 0, total_lessons: 0, total_time_seconds: 0 },
    notifications: [],
    isLoading: true,

    fetchDashboard: async () => {
        set({ isLoading: true });
        try {
            const res = await axios.get('/api/dashboard/init');
            console.log("DEBUG_FRONTEND: Dashboard Data Received:", res.data);
            set({
                lessons: res.data.lessons,
                communityVideos: res.data.community_videos,
                stats: res.data.stats,
                notifications: res.data.notifications,
                sets: res.data.sets || [],
                isLoading: false
            });
        } catch (err) {
            console.error("Dashboard fetch failed", err);
            set({ isLoading: false });
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
