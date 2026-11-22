# Football Analytics Platform

A light-mode post-match analysis project. The planned first competition is the English Premier League.

## Local development

Use Node.js 24 and npm. Run `npm ci`, then `npm run dev` and open http://localhost:3000.

Run `npm run lint`, `npm run typecheck`, and `npm run build` to validate the baseline.

## Data

Recent Results and Match Results use the [PitchAPI league matches endpoint](https://pitchapi.dev/) for the current Premier League season. They display finished matches only, group them by the provider's match date, and use the provider's home and away full-time goal totals. The server revalidates the season response every five minutes.

For local testing with a key already saved in your Windows user environment, run these commands in PowerShell:

```powershell
$env:PITCH_API_KEY = [Environment]::GetEnvironmentVariable('PITCH_API_KEY', 'User')
$env:PITCH_API_RESULTS_ENABLED = 'true'
$env:PITCH_API_CRESTS_ENABLED = 'true'
npm run dev
```

Keep the key server-side. Leave `PITCH_API_RESULTS_ENABLED` unset in public deployments until the provider's display and caching rights are confirmed. With results disabled or the provider unavailable, the homepage shows an unavailable state. A valid date with no completed matches has its own empty state.

Both results views can show club crests from the PitchAPI CDN. Leave `PITCH_API_CRESTS_ENABLED` unset in public deployments until image display rights are confirmed. Both views use initials when a crest is missing or fails to load.

Match Overview uses PitchAPI’s match shots endpoint. The map shows where each attempt was struck on a 105 × 68 metre pitch. The home team attacks right and the away team’s coordinates are rotated so it attacks left, with each team using the same direction across halves. The team xG total sums the available pre-shot probabilities. Missing values are shown separately from zero, and incomplete team totals show how many shots were rated.

The Overview tab combines PitchAPI team stats, lineups, player ratings, and head-to-head history. Comparison bars use each club’s share of the displayed metric. The accurate-passes bar compares completed pass counts, with each club’s completion percentage shown alongside. Head-to-head totals reflect meetings reported by the provider.

Shots on target and open-play and set-play xG are the full-match values from PitchAPI’s team-stats endpoint. The cumulative chart and its per-minute changes are calculated from the shot feed, so the chart’s totals can differ from the provider’s team aggregates. Own goals, when flagged by the shot feed, are excluded from shot and xG totals.

The shot integration was sampled on Manchester City–Fulham, Aston Villa–Sunderland, and Newcastle United–Arsenal. The feed returned 20, 26, and 25 attempts respectively, with pre-shot xG available for every sampled attempt. Earlier sampling across 24 completed Premier League and Bundesliga matches returned results, incidents, team stats, and shot data.
