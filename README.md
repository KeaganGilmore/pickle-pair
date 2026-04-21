# PicklePair

Courtside pickleball tournament pairing. Built for phones and tablets on shaky wifi.

- **Formats**: Round robin · Single elimination · Americano · King of the Court
- **Modes**: Singles & doubles (random / fixed / rotating partners; optional mixed M/F rule)
- **Live ops**: Add / withdraw / substitute players mid-tournament, re-pair rounds, void / forfeit matches, undo
- **Offline-first**: Every write persists locally (IndexedDB / Dexie) and syncs to Supabase in the background
- **Shareable**: Spectator link (read-only), organizer link (edit), QR code, Web Share API
- **PWA**: Installable on phone/tablet home screen; works fully offline

## Run locally

```bash
npm install
cp .env.example .env.local    # then fill in your Supabase URL + anon key
npm run dev
```

Without Supabase configured, the app runs in "local-only" mode — everything
stores in IndexedDB and never leaves the device. Great for quick club nights.

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a repo on GitHub and push this project.
2. In the repo **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
3. Add two repo secrets under **Settings → Secrets and variables → Actions**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds the app
   and publishes it. The site will live at `https://<user>.github.io/picklepair/`.

The Vite `base` is set to `/picklepair/` to match the Pages sub-path. The
workflow also copies `index.html` → `404.html` so client-side routing
works on direct-deep-link loads.

## Supabase setup

1. Create a new Supabase project.
2. In the SQL editor, paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. Enable **anonymous sign-ins** under **Authentication → Providers** (the client
   uses an anonymous session to get a stable uid for RLS).
4. Grab your project URL and anon key from **Settings → API** and drop them into
   `.env.local` (and into the two GitHub Actions secrets above).

### Authorization model

Tournaments are gated by two tokens:

- `token` — short, public spectator URL (read-only)
- `edit_token` — long, unguessable organizer URL

The Supabase RLS policies allow reads to anyone and writes to any authenticated
session; the app only writes rows whose parent tournament it already has the
`edit_token` for. For a stricter setup, put a Supabase Edge Function in front of
writes that verifies a header-bound token — this baseline is the pragmatic
default for the courtside use-case.

## How the pairing engine works

- **Round robin**: circle method. For doubles, teams are formed up front per
  partner mode; rematches are avoided across rounds when possible.
- **Americano**: rotates partners every round, optimizing for partner/opponent
  variety. Mixed mode enforces M/F pairs.
- **Single elimination**: complete bracket built at start from `nextPow2`
  seeding order (standard 1,8,4,5,2,7,3,6); byes auto-advance; winners feed the
  next round when a match is locked.
- **King of the Court**: court 1 = "king". Winners promote, losers demote.
  First round is random; later rounds use prior-round results.

Mixed-mode rules apply anywhere doubles runs — pairs must be one `M` and one
`F`. Warnings surface in the UI if ratios don't allow clean pairs.

## Tech stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS with custom design tokens; Radix primitives wrapped as shadcn-style components
- `@tanstack/react-query` for server state, optimistic updates
- Dexie for IndexedDB cache and offline write queue
- `@supabase/supabase-js` for persistence
- Framer Motion for spring animations
- Zod for runtime validation
- `vite-plugin-pwa` for service worker + manifest

## Project structure

```
src/
  components/        # UI primitives + feature components
    ui/              # Button, Card, Dialog, Sheet, Tabs, ...
  hooks/             # useTournamentData, useOrientation, useMatchTimer
  lib/
    pairing/         # round robin, americano, single elim, king of the court
    db.ts            # Dexie schema
    sync.ts          # offline write queue -> Supabase
    repo.ts          # upsert/delete wrappers that hit Dexie + enqueue
    supabase.ts      # Supabase client
    standings.ts     # W/L, diff, head-to-head tiebreakers
    scoring.ts       # win-condition logic
    types.ts         # Zod schemas and types
  routes/            # Home, NewTournament, Tournament subroutes
  App.tsx
  main.tsx
supabase/schema.sql
.github/workflows/deploy.yml
```

## License

MIT — see [LICENSE](LICENSE).
