import "server-only";
import { getPitchData, inRange, isRecord, isScore, optionalText, type Match } from "../../pitch-api";

function matchResource<T>(id: string, resource: string, parse: (data: Record<string, unknown>) => T) {
  const url = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(id)}/${resource}`;
  return getPitchData(url, resource, (payload) => {
    if (!isRecord(payload) || !isRecord(payload.data) || payload.data.match_id !== id) {
      throw new Error("Invalid match resource");
    }
    return parse(payload.data);
  });
}

type LineupPlayer = {
  id: string;
  name: string;
  number: string | null;
  captain: boolean;
  position: { x: number; y: number } | null;
};

function lineupPlayers(value: unknown): LineupPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((player: unknown): LineupPlayer[] => {
    if (!isRecord(player)) return [];
    const id = optionalText(player.player_id);
    const name = optionalText(player.name);
    if (!id || !name) return [];
    const x = player.pitch_x;
    const y = player.pitch_y;
    return [{
      id, name,
      number: optionalText(player.shirt_number),
      captain: player.is_captain === true,
      position: inRange(x, 1) && inRange(y, 1) && (x !== 0 || y !== 0) ? { x, y } : null,
    }];
  });
}

function lineupSide(value: unknown) {
  if (!isRecord(value)) return null;
  const starters = lineupPlayers(value.starters);
  const bench = lineupPlayers(value.subs);
  if (!starters.length && !bench.length) return null;
  return {
    starters, bench,
    formation: optionalText(value.formation),
    coach: isRecord(value.coach) ? optionalText(value.coach.name) : null,
    confirmed: typeof value.confirmed === "boolean" ? value.confirmed : null,
  };
}

export function getOverviewLineups(match: Match) {
  return matchResource(match.id, "lineups", (data) => {
    const home = lineupSide(data.home);
    const away = lineupSide(data.away);
    return home || away ? { home, away } : null;
  });
}

export function getLineupRatings(match: Match) {
  const url = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(match.id)}/players`;
  return getPitchData(url, "Lineup ratings", (payload) => {
    if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error("Invalid player statistics");
    const ratings = new Map<string, number>();
    for (const entry of payload.data as unknown[]) {
      if (!isRecord(entry) || !isRecord(entry.player) || !Array.isArray(entry.stats)
        || (entry.team_id !== match.homeId && entry.team_id !== match.awayId)) continue;
      const id = optionalText(entry.player.id);
      const top = (entry.stats as unknown[]).find((group) => isRecord(group) && group.key === "top_stats");
      if (!id || !isRecord(top) || !isRecord(top.stats)) continue;
      for (const field of Object.values(top.stats)) {
        if (isRecord(field) && field.key === "rating_title" && isRecord(field.stat)
          && inRange(field.stat.value, 10) && field.stat.value > 0) {
          ratings.set(id, field.stat.value);
          break;
        }
      }
    }
    return ratings;
  });
}

type Meeting = {
  kickoff: string;
  home: "home" | "away";
  score: [number, number] | null;
};

export function getHeadToHead(match: Match) {
  return matchResource(match.id, "h2h", (data) => {
    const { home_team, away_team, home_wins, away_wins, draws, total_matches, recent_matches } = data;
    if (!isRecord(home_team) || home_team.id !== match.homeId
      || !isRecord(away_team) || away_team.id !== match.awayId || !Array.isArray(recent_matches)) {
      throw new Error("Invalid head-to-head history");
    }
    const summary = isScore(home_wins) && isScore(away_wins) && isScore(draws) && isScore(total_matches)
      && home_wins + away_wins + draws === total_matches ? { home_wins, away_wins, draws, total_matches } : null;
    const now = Date.now();
    const meetings = recent_matches.flatMap((entry: unknown): Meeting[] => {
      if (!isRecord(entry) || !isRecord(entry.home) || !isRecord(entry.away)
        || typeof entry.time_utc !== "string" || !Number.isFinite(Date.parse(entry.time_utc))) return [];
      const home = entry.home.id === match.homeId && entry.away.id === match.awayId ? "home"
        : entry.home.id === match.awayId && entry.away.id === match.homeId ? "away" : null;
      if (!home) return [];
      if (entry.finished === true && isScore(entry.score_home) && isScore(entry.score_away)) {
        return [{ kickoff: new Date(entry.time_utc).toISOString(), home, score: [entry.score_home, entry.score_away] }];
      }
      return entry.finished === false && Date.parse(entry.time_utc) > now
        ? [{ kickoff: new Date(entry.time_utc).toISOString(), home, score: null }] : [];
    });
    return { summary, meetings };
  });
}
