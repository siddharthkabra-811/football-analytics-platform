import { Suspense } from "react";
import { getMatchEvents, getMatchShots, type Match } from "../../pitch-api";
import { getAdvancedReports, getHeatmaps, getMomentum, getPassNetworks, getPlayerReports } from "./analysis-data";
import { AdvancedReportsView, PlayerReportsView } from "./analysis-reports";
import { HeatmapView, MomentumChart, PassingView, TheatreReplay, type ReplayStep } from "./analysis-visuals";
import { linkedShot } from "./match-timeline";
import styles from "./analysis.module.css";

const titles = {
  momentum: "Momentum",
  players: "Players",
  passing: "Passing",
  heatmaps: "Heatmaps",
  advanced: "Advanced metrics",
  keepers: "Goalkeepers",
  theatre: "Match theatre",
} as const;

type View = keyof typeof titles;
const eventNames = { goal: "Goal", yellowcard: "Yellow card", redcard: "Red card", substitution: "Substitution", penalty: "Penalty" };

function minuteLabel(minute: number, added: number) {
  return `${minute}${added ? `+${added}` : ""}′`;
}

async function Replay({ match, query }: { match: Match; query: string }) {
  const [events, shots, momentum] = await Promise.all([getMatchEvents(match), getMatchShots(match), getMomentum(match)]);
  const teams = { home: match.home, away: match.away };
  const used = new Set<string>();
  const steps: (ReplayStep & { time: number })[] = (events ?? []).map((event, index) => {
    const shot = linkedShot(event, events ?? [], shots ?? []);
    if (shot) used.add(shot.id);
    const title = event.kind === "goal" && event.ownGoal ? "Own goal"
      : event.kind === "goal" && event.penalty ? "Penalty goal" : eventNames[event.kind];
    const players = event.kind === "substitution"
      ? [event.replacement && `On: ${event.replacement}`, event.player && `Off: ${event.player}`].filter(Boolean).join(" · ")
      : event.player;
    return {
      id: `event-${index}`, minute: minuteLabel(event.minute, event.added), title,
      context: [event.side && teams[event.side], players].filter(Boolean).join(" · ") || "Player information unavailable",
      side: event.side,
      point: shot ? { x: shot.side === "home" ? shot.x : 105 - shot.x, y: shot.side === "home" ? shot.y : 68 - shot.y } : null,
      shotId: shot?.id,
      highlight: event.kind === "goal" || event.kind === "penalty" || event.kind === "redcard",
      xg: shot?.xg ?? null,
      crossing: shot?.placement ? { x: shot.side === "home" ? 105 : 0, y: 34 + (shot.side === "home" ? 1 : -1) * shot.placement.lateral } : null,
      time: event.minute + event.added / (event.added + 1),
    };
  });

  for (const shot of shots ?? []) {
    if (used.has(shot.id)) continue;
    // The event feed can describe the same goal on a slightly different clock.
    // Keep the recorded goal once if its shot could not be joined safely.
    if (shot.goal && events?.some((event) => event.kind === "goal" && event.side === shot.side
      && event.playerId && event.playerId === shot.playerId && Math.abs(event.minute - shot.minute) <= 1)) continue;
    steps.push({
      id: shot.id, minute: minuteLabel(shot.minute, shot.added), title: shot.outcome,
      context: [teams[shot.side], shot.player, shot.xg !== null && `${shot.xg.toFixed(2)} xG`].filter(Boolean).join(" · "),
      side: shot.side,
      point: { x: shot.side === "home" ? shot.x : 105 - shot.x, y: shot.side === "home" ? shot.y : 68 - shot.y },
      shotId: shot.id, time: shot.minute + shot.added / (shot.added + 1),
      highlight: shot.goal || (shot.xg !== null && shot.xg >= .2),
      xg: shot.xg,
      crossing: shot.placement ? { x: shot.side === "home" ? 105 : 0, y: 34 + (shot.side === "home" ? 1 : -1) * shot.placement.lateral } : null,
    });
  }

  if (!steps.length) return <Unavailable />;
  const replay = steps.sort((a, b) => a.time - b.time).map(({ time, ...step }) => {
    const point = momentum?.reduce<{ minute: number; value: number } | null>((nearest, sample) =>
      !nearest || Math.abs(sample.minute - time) < Math.abs(nearest.minute - time) ? sample : nearest, null);
    return { ...step, pressure: point && Math.abs(point.minute - time) <= 1.5 ? point.value : null };
  });
  return <TheatreReplay steps={replay} teams={teams} query={query} />;
}

function Unavailable() {
  return <p className={styles.panel}>Match data is unavailable for this view.</p>;
}

async function AnalysisContent({ view, match, query }: { view: View; match: Match; query: string }) {
  const clubs = { home: match.home, away: match.away };
  switch (view) {
    case "momentum": {
      const points = await getMomentum(match);
      return points?.length ? <MomentumChart points={points} teams={clubs} /> : <Unavailable />;
    }
    case "players": {
      const reports = await getPlayerReports(match);
      return reports.length ? <PlayerReportsView reports={reports} teams={clubs} /> : <Unavailable />;
    }
    case "passing": {
      const [networks, reports] = await Promise.all([getPassNetworks(match), getAdvancedReports(match)]);
      const passing = (reports ?? []).map((report) => ({ ...report, groups: report.groups.filter((group) => group.label === "passing") }))
        .filter((report) => report.groups.length);
      return <>
        {networks?.length ? <PassingView networks={networks} teams={clubs} /> : <Unavailable />}
        {passing.length > 0 && <><h3>Full-match passing</h3><AdvancedReportsView teams={passing} players={[]} clubs={clubs} /></>}
      </>;
    }
    case "heatmaps": {
      const data = await getHeatmaps(match);
      return data?.reports.length ? <HeatmapView {...data} teams={clubs} /> : <Unavailable />;
    }
    case "advanced": {
      const [teams, players] = await Promise.all([getAdvancedReports(match), getAdvancedReports(match, true)]);
      return teams?.length || players?.length
        ? <AdvancedReportsView teams={teams ?? []} players={players ?? []} clubs={clubs} /> : <Unavailable />;
    }
    case "keepers": {
      const [advanced, basic] = await Promise.all([getAdvancedReports(match, true), getPlayerReports(match)]);
      const reports = (advanced ?? []).map((report) => ({ ...report, groups: report.groups.filter((group) => group.label === "goalkeeping") }))
        .filter((report) => report.groups.length);
      const ids = new Set(reports.map((report) => report.id));
      const keeperStats = basic.filter((report) => ids.has(report.player.id) || report.periods.some(({ groups }) =>
        groups.some(({ metrics }) => metrics.some(({ key }) => ["goals_prevented", "expected_goals_on_target_faced", "keeper_saves"].includes(key)))));
      return <>
        {reports.length > 0 && <AdvancedReportsView teams={[]} players={reports} clubs={clubs} keepers />}
        {keeperStats.length > 0 && <><h3>Goalkeeper match stats</h3><PlayerReportsView reports={keeperStats} teams={clubs} /></>}
        {!reports.length && !keeperStats.length && <Unavailable />}
      </>;
    }
    case "theatre": return <Replay match={match} query={query} />;
  }
}

export function ExtraAnalysis({ view, match, query }: { view: View; match: Match; query: string }) {
  return <section className={styles.section} aria-labelledby="match-analysis-view">
    <h2 id="match-analysis-view">{titles[view]}</h2>
    <Suspense fallback={<p className={styles.panel} role="status">Loading {titles[view].toLowerCase()}…</p>}>
      <AnalysisContent view={view} match={match} query={query} />
    </Suspense>
  </section>;
}
