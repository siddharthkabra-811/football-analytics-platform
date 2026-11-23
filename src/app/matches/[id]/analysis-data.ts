import "server-only";
import { getPitchData, inRange, isRecord, isScore, optionalText, type Match } from "../../pitch-api";

type Side = "home" | "away";
type Entity = { id: string; name: string; number: string | null };
export type NumberGroup = { label: string; metrics: { key: string; value: number | null }[] };
type PlayerGroup = { label: string; metrics: { key: string; label: string; value: string | null }[] };
export type PlayerReport = { player: Entity; side: Side; periods: { period: string; groups: PlayerGroup[] }[] };
export type AdvancedReport = { id: string; name: string; side: Side; groups: NumberGroup[] };
export type HeatReport = { id: string; name: string; side: Side; player: boolean; actions: number | null; cells: [number, number, number][] };
export type PassNetwork = {
  side: Side; until: number | null; window: string | null; centralization: number | null;
  nodes: { player: Entity; x: number | null; y: number | null; metrics: NumberGroup["metrics"] }[];
  edges: { from: string; to: string; passes: number }[];
};

function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function entity(value: unknown): Entity | null {
  if (!isRecord(value)) return null;
  const id = optionalText(value.id);
  const name = optionalText(value.name);
  const jersey = value.shirt_number;
  return id && name ? { id, name, number: isScore(jersey) ? String(jersey) : optionalText(jersey) } : null;
}
function sideFor(match: Match, id: unknown): Side | null {
  return id === match.homeId ? "home" : id === match.awayId ? "away" : null;
}
function resource<T>(match: Match, path: string, parse: (data: Record<string, unknown>) => T) {
  return getPitchData(`https://api.pitchapi.dev/v1/matches/${encodeURIComponent(match.id)}/${path}`, path, (payload) => {
    if (!isRecord(payload) || !isRecord(payload.data) || payload.data.match_id !== match.id) {
      throw new Error("Invalid match analytics envelope");
    }
    return parse(payload.data);
  });
}

export function getMomentum(match: Match) {
  return resource(match, "momentum", (data) => list(data.points).flatMap((point): { minute: number; value: number }[] => {
    if (!isRecord(point) || !inRange(point.minute, 150)) return [];
    const value = number(point.value);
    return value === null ? [] : [{ minute: point.minute, value }];
  }).sort((a, b) => a.minute - b.minute));
}

function playerGroups(value: unknown): PlayerGroup[] {
  return list(value).flatMap((group): PlayerGroup[] => {
    if (!isRecord(group) || !isRecord(group.stats)) return [];
    const metrics = Object.entries(group.stats).flatMap(([label, detail]): PlayerGroup["metrics"] => {
      if (!isRecord(detail) || !isRecord(detail.stat) || typeof detail.key !== "string" || !detail.key
        || detail.stat.type === "boolean") return [];
      const v = number(detail.stat.value);
      const total = number(detail.stat.total);
      const value = v === null ? null : total === null ? String(v)
        : `${v}/${total}${detail.stat.type === "fractionWithPercentage" && total > 0 ? ` (${Math.round(v / total * 100)}%)` : ""}`;
      return [{ key: detail.key, label, value }];
    });
    return metrics.length ? [{ label: optionalText(group.title) ?? "Player stats", metrics }] : [];
  });
}

export function getPlayerReports(match: Match) {
  const root = `https://api.pitchapi.dev/v1/matches/${encodeURIComponent(match.id)}`;
  const full = getPitchData(`${root}/players`, "Player stats", (payload) => {
    if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error("Invalid player stats");
    return list(payload.data);
  });
  const halves = resource(match, "players/halves", (data) => list(data.players));
  return Promise.all([full, halves]).then(([all, split]) => {
    const reports = new Map<string, PlayerReport>();
    for (const [entries, isFull] of [[all ?? [], true], [split ?? [], false]] as const) {
      for (const entry of entries) {
        if (!isRecord(entry)) continue;
        const player = entity(entry.player);
        const side = sideFor(match, entry.team_id);
        if (!player || !side) continue;
        const report = reports.get(player.id) ?? { player, side, periods: [] };
        const periods = isFull ? [{ period: "All", stats: entry.stats }] : list(entry.periods);
        for (const period of periods) {
          if (!isRecord(period) || typeof period.period !== "string") continue;
          const groups = playerGroups(period.stats);
          if (groups.length) report.periods.push({ period: period.period, groups });
        }
        if (report.periods.length) reports.set(player.id, report);
      }
    }
    return [...reports.values()];
  });
}

function numericMetrics(value: Record<string, unknown>, prefix = ""): NumberGroup["metrics"] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix} · ${key}` : key;
    if (isRecord(entry)) return numericMetrics(entry, path);
    return entry === null || number(entry) !== null ? [{ key: path, value: number(entry) }] : [];
  });
}

export function getAdvancedReports(match: Match, players = false) {
  return resource(match, players ? "advanced/players" : "advanced", (data) =>
    list(players ? data.players : data.teams).flatMap((entry): AdvancedReport[] => {
      if (!isRecord(entry)) return [];
      const subject = entity(players ? entry.player : entry.team);
      const side = sideFor(match, players ? entry.team_id : subject?.id);
      if (!subject || !side) return [];
      const groups = Object.entries(entry).flatMap(([label, group]): NumberGroup[] => {
        if (label === "team" || label === "player" || !isRecord(group)) return [];
        const metrics = numericMetrics(group);
        return metrics.length ? [{ label, metrics }] : [];
      });
      const activity = numericMetrics(Object.fromEntries(Object.entries(entry).filter(([key]) => key === "actions" || key === "minutes_played")));
      return [{ id: subject.id, name: subject.name, side, groups: [{ label: "Activity", metrics: activity }, ...groups] }];
    }));
}

export function getHeatmaps(match: Match) {
  return resource(match, "heatmaps?frame=home_ltr", (data) => {
    const grid = data.grid;
    if (!isRecord(grid) || grid.frame !== "home_ltr" || !isScore(grid.length) || !isScore(grid.width)
      || !grid.length || !grid.width || grid.length > 50 || grid.width > 50) throw new Error("Invalid heatmap grid");
    const length = grid.length;
    const width = grid.width;
    const reports = [false, true].flatMap((player) =>
      list(player ? data.players : data.teams).flatMap((entry): HeatReport[] => {
        if (!isRecord(entry)) return [];
        const team = entity(entry.team);
        const subject = player ? entity(entry.player) : team;
        const side = sideFor(match, team?.id);
        if (!subject || !side) return [];
        const cells = list(entry.cells).flatMap((cell): HeatReport["cells"] => {
          if (!Array.isArray(cell)) return [];
          const [x, y, count] = cell as unknown[];
          return isScore(x) && x < length && isScore(y) && y < width && isScore(count) && count > 0 ? [[x, y, count]] : [];
        });
        return [{ ...subject, player, side, cells, actions: isScore(entry.actions) ? entry.actions : null }];
      }));
    return { length, width, reports };
  });
}

export function getPassNetworks(match: Match) {
  return resource(match, "advanced/network", (data) => list(data.networks).flatMap((entry): PassNetwork[] => {
    if (!isRecord(entry)) return [];
    const side = sideFor(match, entity(entry.team)?.id);
    if (!side) return [];
    const window = isRecord(entry.window) ? entry.window : {};
    const nodes = list(entry.nodes).flatMap((node): PassNetwork["nodes"] => {
      if (!isRecord(node)) return [];
      const player = entity(node.player);
      if (!player) return [];
      const { player: _, avg_x, avg_y, ...metrics } = node;
      void _;
      return [{ player, x: inRange(avg_x, 105) ? avg_x : null, y: inRange(avg_y, 68) ? avg_y : null, metrics: numericMetrics(metrics) }];
    });
    const edges = list(entry.edges).flatMap((edge): PassNetwork["edges"] => {
      if (!isRecord(edge)) return [];
      const from = entity(edge.from)?.id;
      const to = entity(edge.to)?.id;
      return from && to && isScore(edge.passes) && edge.passes > 0 ? [{ from, to, passes: edge.passes }] : [];
    });
    return [{ side, nodes, edges, until: number(window.until_seconds), window: optionalText(window.kind), centralization: number(entry.centralization) }];
  }));
}
