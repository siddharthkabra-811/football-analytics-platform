import "server-only";

const premierLeagueId = "l_4WFCIZ";
const resultsUrl = `https://api.pitchapi.dev/v1/leagues/${premierLeagueId}/matches?status=played`;
const revalidateSeconds = 300;

export type Match = {
  id: string;
  date: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  homeCrest: string | null;
  awayCrest: string | null;
  score: [number, number];
};

export type MatchShot = {
  id: string;
  side: "home" | "away";
  player: string | null;
  playerId: string | null;
  x: number;
  y: number;
  xg: number | null;
  xgot: number | null;
  placement: { lateral: number; height: number } | null;
  block: { x: number; y: number } | null;
  period: string | null;
  keeper: string | null;
  insideBox: boolean | null;
  ownGoal: boolean;
  minute: number;
  added: number;
  outcome: string;
  situation: string | null;
  technique: string | null;
  goal: boolean;
};

type ComparisonValue = { home: number | null; away: number | null };
export type ShootingStats = {
  onTarget: ComparisonValue | null;
  openPlayXg: ComparisonValue | null;
  setPlayXg: ComparisonValue | null;
};

export type MatchEvent = {
  kind: "goal" | "yellowcard" | "redcard" | "substitution" | "penalty";
  minute: number;
  added: number;
  side: MatchShot["side"] | null;
  player: string | null;
  playerId: string | null;
  replacement: string | null;
  replacementId: string | null;
  ownGoal: boolean;
  penalty: boolean;
};

export function isMatchDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function crestUrl(team: unknown): string | null {
  if (process.env.PITCH_API_CRESTS_ENABLED !== "true" || !isRecord(team)) return null;
  const url = team.image_url;
  return typeof url === "string" && /^https:\/\/cdn\.pitchapi\.dev\/(?:images\/)?teams\/[a-zA-Z0-9_-]+\.webp$/.test(url)
    ? url
    : null;
}

function parseResults(payload: unknown): Match[] {
  if (!isRecord(payload) || !isRecord(payload.data)) throw new Error("Invalid response envelope");

  const { league, matches } = payload.data;
  if (!isRecord(league) || league.id !== premierLeagueId || !Array.isArray(matches)) {
    throw new Error("Invalid Premier League results payload");
  }

  return matches.flatMap((match: unknown): Match[] => {
    if (!isRecord(match) || typeof match.status !== "string") {
      throw new Error("Invalid match status");
    }
    if (match.status !== "finished") return [];

    const { id, date, home_team, away_team, score_home, score_away } = match;
    const home = isRecord(home_team) ? home_team.name : undefined;
    const away = isRecord(away_team) ? away_team.name : undefined;
    const homeId = isRecord(home_team) ? home_team.id : undefined;
    const awayId = isRecord(away_team) ? away_team.id : undefined;
    if (typeof id !== "string" || !id || !isMatchDate(date)
      || typeof home !== "string" || !home.trim() || typeof away !== "string" || !away.trim()
      || typeof homeId !== "string" || !homeId || typeof awayId !== "string" || !awayId || homeId === awayId
      || !isScore(score_home) || !isScore(score_away)) {
      throw new Error("Invalid finished match");
    }

    return [{
      id, date, home: home.trim(), away: away.trim(), homeId, awayId,
      homeCrest: crestUrl(home_team), awayCrest: crestUrl(away_team),
      score: [score_home, score_away],
    }];
  });
}

export async function getPitchData<T>(url: string, label: string, parse: (payload: unknown) => T): Promise<T | null> {
  // Enable only in environments where provider data may be displayed.
  if (process.env.PITCH_API_RESULTS_ENABLED !== "true") return null;
  const key = process.env.PITCH_API_KEY?.trim();
  if (!key) {
    console.error("[PitchAPI] Data is enabled but PITCH_API_KEY is missing.");
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-API-KEY": key },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) {
      console.error("[PitchAPI] Request failed.", { label, status: response.status });
      return null;
    }
    const payload: unknown = await response.json();
    return parse(payload);
  } catch {
    console.error("[PitchAPI] Request timed out, failed, or returned invalid data.", { label });
    return null;
  }
}

export function getPremierLeagueResults() {
  return getPitchData(resultsUrl, "Premier League results", parseResults);
}

export function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

export function getMatchBannerDetails(id: string) {
  const url = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(id)}`;
  return getPitchData(url, "Match banner", (payload) => {
    if (!isRecord(payload) || !isRecord(payload.data) || payload.data.id !== id
      || !isRecord(payload.data.league) || payload.data.league.id !== premierLeagueId) {
      throw new Error("Invalid match details");
    }
    const { league, time_utc, round_name, referee, stadium, season } = payload.data;
    const kickoff = typeof time_utc === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(time_utc)
      && isMatchDate(time_utc.slice(0, 10)) && Number.isFinite(Date.parse(time_utc)) ? time_utc : null;
    const image = league.image_url;
    const leagueLogo = process.env.PITCH_API_CRESTS_ENABLED === "true" && typeof image === "string"
      && /^https:\/\/cdn\.pitchapi\.dev\/(?:images\/)?leagues\/[a-zA-Z0-9_-]+\.webp$/.test(image) ? image : null;
    return {
      kickoff, leagueLogo,
      round: optionalText(round_name),
      season: optionalText(season),
      referee: optionalText(referee),
      stadium: optionalText(stadium),
    };
  });
}

export function inRange(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

function outcomeLabel(event: string, blocked: boolean, cleared: boolean, ownGoal: boolean) {
  if (ownGoal) return "Own goal";
  if (event === "Goal") return "Goal";
  if (cleared) return "Cleared off the line";
  if (blocked) return "Blocked";
  switch (event) {
    case "AttemptSaved": return "Saved";
    case "Miss": return "Off target";
    case "Post": return "Hit the woodwork";
    default: return "Outcome unavailable";
  }
}

const shotSituations = new Map([
  ["RegularPlay", "Open play"],
  ["FromCorner", "Corner"],
  ["SetPiece", "Set piece"],
  ["FastBreak", "Counterattack"],
  ["FreeKick", "Free kick"],
  ["ThrowInSetPiece", "Throw-in"],
  ["Penalty", "Penalty"],
  ["IndividualPlay", "Individual play"],
]);

const shotTechniques = new Map([
  ["RightFoot", "Right foot"],
  ["LeftFoot", "Left foot"],
  ["Header", "Header"],
  ["OtherBodyParts", "Other body part"],
]);

export function getMatchShots(match: Match) {
  const url = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(match.id)}/shots`;
  return getPitchData(url, "Match shots", (payload): MatchShot[] => {
    if (!isRecord(payload) || !isRecord(payload.data) || payload.data.match_id !== match.id
      || !Array.isArray(payload.data.periods)) {
      throw new Error("Invalid shots response");
    }

    const shots = new Map<string, MatchShot>();
    for (const period of payload.data.periods as unknown[]) {
      if (!isRecord(period) || !Array.isArray(period.shots)) throw new Error("Invalid shot period");
      const periodName = optionalText(period.period);
      for (const shot of period.shots as unknown[]) {
        if (!isRecord(shot)) throw new Error("Invalid shot");

        const { id, team_id, x, y, expected_goals, minute, minute_added, event_type, player, is_blocked } = shot;
        if (typeof id !== "string" || !id || !inRange(x, 105) || !inRange(y, 68)
          || !isScore(minute) || typeof event_type !== "string"
          || (team_id !== match.homeId && team_id !== match.awayId)) {
          throw new Error("Invalid shot details");
        }

        const ownGoal = shot.is_own_goal === true;
        const blocked = is_blocked === true;
        const cleared = shot.is_saved_off_line === true;
        shots.set(id, {
          id,
          side: team_id === match.homeId ? "home" : "away",
          player: isRecord(player) && typeof player.name === "string" ? player.name.trim() || null : null,
          playerId: isRecord(player) ? optionalText(player.id) : null,
          x, y,
          xg: !ownGoal && inRange(expected_goals, 1) ? expected_goals : null,
          xgot: !ownGoal && !blocked && !cleared && (event_type === "Goal" || event_type === "AttemptSaved")
            && inRange(shot.expected_goals_on_target, 1) ? shot.expected_goals_on_target : null,
          placement: !blocked && !cleared && inRange(shot.goal_crossed_y, 68) && inRange(shot.goal_crossed_z, 7.6)
            ? { lateral: shot.goal_crossed_y - 34, height: shot.goal_crossed_z }
            : null,
          minute,
          added: isScore(minute_added) ? minute_added : 0,
          block: (blocked || cleared) && inRange(shot.blocked_x, 105) && inRange(shot.blocked_y, 68)
            ? { x: shot.blocked_x, y: shot.blocked_y } : null,
          period: periodName,
          keeper: isRecord(shot.keeper) ? optionalText(shot.keeper.name) : null,
          insideBox: typeof shot.is_inside_box === "boolean" ? shot.is_inside_box : null,
          ownGoal,
          outcome: outcomeLabel(event_type, blocked, cleared, ownGoal),
          situation: typeof shot.situation === "string" ? shotSituations.get(shot.situation) ?? null : null,
          technique: typeof shot.shot_type === "string" ? shotTechniques.get(shot.shot_type) ?? null : null,
          goal: event_type === "Goal" || ownGoal,
        });
      }
    }
    return [...shots.values()].sort((a, b) => a.minute - b.minute || a.added - b.added);
  });
}

export function getMatchEvents(match: Match) {
  const url = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(match.id)}/events`;
  return getPitchData(url, "Match events", (payload): MatchEvent[] => {
    if (!isRecord(payload) || !isRecord(payload.data) || payload.data.match_id !== match.id
      || !Array.isArray(payload.data.events)) throw new Error("Invalid match events response");

    const entries = (payload.data.events as unknown[]).flatMap((event): (MatchEvent & {
      reportedScore: string | null;
    })[] => {
      if (!isRecord(event) || typeof event.event_type !== "string" || !isScore(event.minute)) return [];
      const kind = event.event_type.toLowerCase();
      if (kind !== "goal" && kind !== "yellowcard" && kind !== "redcard"
        && kind !== "substitution" && kind !== "penalty") return [];

      return [{
        kind,
        minute: event.minute,
        added: isScore(event.minute_added) ? event.minute_added : 0,
        side: event.team_id === match.homeId ? "home" : event.team_id === match.awayId ? "away" : null,
        player: isRecord(event.player) ? optionalText(event.player.name) : null,
        playerId: isRecord(event.player) ? optionalText(event.player.id) : null,
        replacement: isRecord(event.sub_in_player) ? optionalText(event.sub_in_player.name) : null,
        replacementId: isRecord(event.sub_in_player) ? optionalText(event.sub_in_player.id) : null,
        ownGoal: event.is_own_goal === true,
        penalty: event.is_penalty === true,
        reportedScore: isScore(event.score_home) && isScore(event.score_away)
          ? `${event.score_home}:${event.score_away}` : null,
      }];
    }).sort((a, b) => a.minute - b.minute || a.added - b.added);

    // Repeated goal entries can be a minute apart while carrying the same score snapshot.
    const seenGoals = new Map<string, { minute: number; added: number }>();
    return entries.filter((event) => {
      if (event.kind !== "goal" || !event.playerId || !event.side || event.reportedScore === null) return true;
      const key = JSON.stringify([event.playerId, event.side, event.reportedScore, event.ownGoal, event.penalty]);
      const previous = seenGoals.get(key);
      if (previous && ((previous.minute === event.minute && previous.added === event.added)
        || (!previous.added && !event.added && event.minute - previous.minute === 1))) return false;
      seenGoals.set(key, { minute: event.minute, added: event.added });
      return true;
    });
  });
}

export type MatchStat = { key: string; home: string | null; away: string | null };

export function getMatchStatPeriods(id: string) {
  const url = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(id)}/stats`;
  return getPitchData(url, "Match team stats", (payload) => {
    if (!isRecord(payload) || !isRecord(payload.data) || payload.data.match_id !== id
      || !Array.isArray(payload.data.periods)) throw new Error("Invalid match stats response");

    return (payload.data.periods as unknown[]).flatMap((entry): { period: string; items: MatchStat[] }[] => {
      if (!isRecord(entry) || typeof entry.period !== "string" || !Array.isArray(entry.groups)) return [];
      const items = (entry.groups as unknown[]).flatMap((group): MatchStat[] => {
        if (!isRecord(group) || !Array.isArray(group.items)) return [];
        return (group.items as unknown[]).flatMap((item): MatchStat[] => {
          if (!isRecord(item) || typeof item.key !== "string") return [];
          return [{ key: item.key, home: optionalText(item.home), away: optionalText(item.away) }];
        });
      });
      return [{ period: entry.period, items }];
    });
  });
}

export async function getShootingStats(id: string): Promise<ShootingStats | null> {
  const items = (await getMatchStatPeriods(id))?.find(({ period }) => period === "All")?.items ?? [];
  if (!items.length) return null;
  function readValue(value: unknown, integer: boolean) {
    if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) && (!integer || Number.isSafeInteger(number)) ? number : null;
  }

  function readStat(key: string, integer = false): ComparisonValue | null {
    for (const item of items) {
      if (item.key !== key) continue;
      const home = readValue(item.home, integer);
      const away = readValue(item.away, integer);
      if (home !== null || away !== null) return { home, away };
    }
    return null;
  }

  return {
    onTarget: readStat("ShotsOnTarget", true),
    openPlayXg: readStat("expected_goals_open_play"),
    setPlayXg: readStat("expected_goals_set_play"),
  };
}
