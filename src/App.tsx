import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/Toaster';
import { Home } from './routes/Home';
import { NewTournament } from './routes/NewTournament';
import { TournamentLayout } from './routes/TournamentLayout';
import { TournamentOverview } from './routes/TournamentOverview';
import { TournamentMatches } from './routes/TournamentMatches';
import { TournamentStandings } from './routes/TournamentStandings';
import { TournamentBracket } from './routes/TournamentBracket';
import { TournamentSettings } from './routes/TournamentSettings';
import { PlayerView } from './routes/PlayerView';
import { MatchView } from './routes/MatchView';
import { NotFound } from './routes/NotFound';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewTournament />} />
        <Route path="/t/:token" element={<TournamentLayout />}>
          <Route index element={<TournamentOverview />} />
          <Route path="matches" element={<TournamentMatches />} />
          <Route path="matches/:matchId" element={<MatchView />} />
          <Route path="standings" element={<TournamentStandings />} />
          <Route path="bracket" element={<TournamentBracket />} />
          <Route path="settings" element={<TournamentSettings />} />
          <Route path="player/:playerId" element={<PlayerView />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </AppShell>
  );
}
