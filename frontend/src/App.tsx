import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { usePlayerStore } from './store/usePlayerStore';
import { MainLayout } from './components/layout/MainLayout';
import { PlayerView } from './components/player/PlayerView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ExploreView } from './components/explore/ExploreView';
import { StatsView } from './components/profile/StatsView';
import { ImportView } from './components/dashboard/ImportView';
import { SetListView, SetDetailView } from './components/dashboard/PlaylistViews';

import { PlayerErrorBoundary } from './components/common/PlayerErrorBoundary';

// Wrapper for Sets to handle list vs detail
const SetsWrapper: React.FC = () => {
  const [selectedSetId, setSelectedSetId] = React.useState<number | null>(null);
  
  if (selectedSetId) {
    return <SetDetailView playlistId={selectedSetId} onBack={() => setSelectedSetId(null)} />;
  }
  return <SetListView onSelect={(id) => setSelectedSetId(id)} />;
};

// Wrapper for Player to handle fetching data from URL params
const PlayerRouteWrapper: React.FC<{ mode?: 'player' | 'studio' }> = ({ mode = 'player' }) => {
  const { id } = useParams<{ id: string }>();
  const { fetchLessonData, setLessonData, lessonId } = usePlayerStore();

  useEffect(() => {
    if (!id) return;
    const numericId = parseInt(id);
    if (isNaN(numericId)) return;

    const serverData = (window as any).__PODLEARN_DATA__;
    
    // CASE 1: Full Page Reload / First Visit to specific lesson
    if (serverData && serverData.lesson_id === numericId && lessonId !== numericId) {
      setLessonData(serverData);
      fetchLessonData(numericId);
    } 
    // CASE 2: Client-side Navigation
    else if (lessonId !== numericId) {
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
  return (
    <BrowserRouter basename="/">
      <MainLayout>
        <Routes>
          {/* Main Dashboard */}
          <Route path="/" element={<DashboardView />} />

          {/* Library Sets */}
          <Route path="/sets" element={<SetsWrapper />} />
          
          {/* Explore / Search */}
          <Route path="/explore" element={<ExploreView />} />
          
          {/* Profile / Stats */}
          <Route path="/profile" element={<StatsView />} />
          
          {/* Import New Video */}
          <Route path="/import" element={<ImportView />} />
          
          {/* Player View */}
          <Route path="/player/lesson/:id" element={<PlayerRouteWrapper mode="player" />} />
          <Route path="/player/lesson/syncstudio/:id" element={<PlayerRouteWrapper mode="studio" />} />
          
          {/* Fallback */}
          <Route path="*" element={<DashboardView />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
