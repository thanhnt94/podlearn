import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { usePlayerStore } from './store/usePlayerStore';
import { MainLayout } from './components/layout/MainLayout';
import { PlayerView } from './components/player/PlayerView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ExploreView } from './components/explore/ExploreView';
import { StatsView } from './components/profile/StatsView';
import { MasteryView } from './components/mastery/MasteryView';

// Wrapper for Player to handle fetching data from URL params
const PlayerRouteWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { fetchLessonData, setLessonData, lessonId } = usePlayerStore();

  useEffect(() => {
    if (id) {
      const numericId = parseInt(id);
      const data = (window as any).__PODLEARN_DATA__;
      
      // If we have data from server for THIS specific lesson, hydrate the store immediately
      // This fix ensures videoId is set before the player component renders.
      if (data && data.lesson_id === numericId && lessonId !== numericId) {
         setLessonData(data);
         fetchLessonData(numericId);
      } else if (lessonId !== numericId) {
         fetchLessonData(numericId);
      }
    }
  }, [id, fetchLessonData, setLessonData, lessonId]);

  return <PlayerView />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter basename="/">
      <MainLayout>
        <Routes>
          {/* Main Dashboard */}
          <Route path="/" element={<DashboardView />} />
          
          {/* Mastery / Flashcards */}
          <Route path="/mastery" element={<MasteryView />} />
          
          {/* Explore / Search */}
          <Route path="/explore" element={<ExploreView />} />
          
          {/* Profile / Stats */}
          <Route path="/profile" element={<StatsView />} />
          
          {/* Player View */}
          <Route path="/player/lesson/:id" element={<PlayerRouteWrapper />} />
          
          {/* Fallback */}
          <Route path="*" element={<DashboardView />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
