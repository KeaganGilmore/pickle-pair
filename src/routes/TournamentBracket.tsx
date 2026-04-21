import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentData } from '@/hooks/useTournament';
import { BracketSvg } from '@/components/BracketSvg';

export function TournamentBracket() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { tournament, matches, playersById } = useTournamentData(token);
  if (!tournament) return null;
  const bracketMatches = matches.filter((m) => m.bracket_slot);
  if (bracketMatches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
        No bracket yet. Start the tournament to build it.
      </div>
    );
  }
  return (
    <div className="mt-2">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Bracket
      </h2>
      <BracketSvg
        matches={bracketMatches}
        players={playersById}
        onMatchClick={(m) => navigate(`/t/${token}/matches/${m.id}`)}
      />
    </div>
  );
}
