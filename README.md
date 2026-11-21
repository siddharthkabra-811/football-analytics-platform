# Football Analytics Platform

A light-mode post-match analysis project. The planned first competition is the English Premier League.

## Local development

Use Node.js 24 and npm. Run `npm ci`, then `npm run dev` and open http://localhost:3000.

Run `npm run lint`, `npm run typecheck`, and `npm run build` to validate the baseline.

## Data

PitchAPI coverage was sampled across 24 completed matches in the English Premier League and German Bundesliga. Each sampled match returned results, incidents, team stats and shot data. Public data display, caching and asset rights are pending. Keep `PITCH_API_KEY` server-side. The setup page requires no credential.
