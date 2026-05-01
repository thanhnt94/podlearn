import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { usePlayerStore } from './store/usePlayerStore';
import { useAppStore } from './store/useAppStore';
import { MainLayout } from './components/layout/MainLayout';
import { PlayerView } from './components/player/PlayerView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ExploreView } from './components/explore/ExploreView';
import { StatsView } from './components/profile/StatsView';
import { ImportView } from './components/dashboard/ImportView';
import { SetListView, SetDetailView } from './components/dashboard/PlaylistViews';
import { FlashcardReview } from './components/mastery/FlashcardReview';
import { LoginView } from './components/auth/LoginView';

import { PlayerErrorBoundary } from './components/common/PlayerErrorBoundary';
import axios from 'axios';

// ── Global Axios Config (JWT & API Base) ─────────────────────
axios.defaults.baseURL = '/';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && !config.url?.startsWith('http')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle global 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // Force reload to trigger LoginView
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

const SetsWrapper: React.FC = () => {
  const [selectedSetId, setSelectedSetId] = React.useState<number | null>(null);
  if (selectedSetId) {
    return <SetDetailView playlistId={selectedSetId} onBack={() => setSelectedSetId(null)} />;
  }
  return <SetListView onSelect={(id) => setSelectedSetId(id)} />;
};

const PlayerRouteWrapper: React.FC<{ mode?: 'player' | 'studio' }> = ({ mode = 'player' }) => {
  const { id } = useParams<{ id: string }>();
  const { fetchLessonData, lessonId } = usePlayerStore();

  useEffect(() => {
    if (!id) return;
    const numericId = parseInt(id);
    if (!isNaN(numericId) && lessonId !== numericId) {
      fetchLessonData(numericId);
    }
  }, [id, lessonId]);

  return (
    <PlayerErrorBoundary key={id}>
        <PlayerView initialStudioMode={mode === 'studio'} />
    </PlayerErrorBoundary>
  );
};

const App: React.FC = () => {
  const { fetchDashboard, isLoggedIn, isLoading } = useAppStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (!isLoggedIn && !isLoading) {
    return <LoginView />;
  }

  return (
    <BrowserRouter basename="/">
      <MainLayout>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/sets" element={<SetsWrapper />} />
          <Route path="/explore" element={<ExploreView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/import" element={<ImportView />} />
          <Route path="/practice/sentence/:setId" element={<FlashcardReview />} />
          <Route path="/player/lesson/:id" element={<PlayerRouteWrapper mode="player" />} />
          <Route path="/player/lesson/syncstudio/:id" element={<PlayerRouteWrapper mode="studio" />} />
          <Route path="*" element={<DashboardView />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
