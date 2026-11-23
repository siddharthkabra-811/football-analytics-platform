import { Suspense } from "react";
import { ClubCrest } from "../../club-crest";
import { getMatchEvents, getMatchStatPeriods, type Match, type MatchEvent } from "../../pitch-api";
import { getHeadToHead, getLineupRatings, getOverviewLineups, type LineupProfile } from "./overview-data";
import { FormationPlayer } from "./formation-player";
import { overviewMetrics } from "./overview-metrics";
import { OverviewStats } from "./overview-stats";
import styles from "./overview.module.css";

type Lineup = NonNullable<Awaited<ReturnType<typeof getOverviewLineups>>>["home"];
type Player = NonNullable<Lineup>["starters"][number];
const sides = ["home", "away"] as const;
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" });
const kickoff = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone: "Europe/London",
});

function clubsFor(match: Match) {
  return { home: { name: match.home, crest: match.homeCrest }, away: { name: match.away, crest: match.awayCrest } };
}

async function StatsPanel({ data, match, full }: { data: ReturnType<typeof getMatchStatPeriods>; match: Match; full: boolean }) {
  const clubs = clubsFor(match);
  const keys = new Set<string>(overviewMetrics.map(([key]) => key));
  const periods = (await data ?? []).map(({ period, items }) => ({
    period,
    items: full ? items : items.filter(({ key }) => keys.has(key)),
  }));
  return <OverviewStats data={periods} home={clubs.home} away={clubs.away} full={full} />;
}

const incidentTypes = {
  goal: { symbol: "G", label: "Goal" },
  ownGoal: { symbol: "OG", label: "Own goal" },
  yellowcard: { symbol: "■", label: "Yellow card" },
  redcard: { symbol: "■", label: "Red card" },
  on: { symbol: "↑", label: "Subbed on" },
  off: { symbol: "↓", label: "Subbed off" },
} as const;

type IncidentKind = keyof typeof incidentTypes;
type Incident = { kind: IncidentKind; minute: string };

function playerIncidents(events: MatchEvent[]) {
  const bySide = { home: new Map<string, Incident[]>(), away: new Map<string, Incident[]>() };
  for (const event of events) {
    if (!event.side) continue;
    const players = bySide[event.side];
    const minute = `${event.minute}${event.added ? `+${event.added}` : ""}′`;
    function record(id: string | null, kind: IncidentKind) {
      if (!id) return;
      const incidents = players.get(id) ?? [];
      incidents.push({ kind, minute });
      players.set(id, incidents);
    }
    if (event.kind === "substitution") {
      record(event.playerId, "off");
      record(event.replacementId, "on");
    } else if (event.kind === "goal") {
      record(event.playerId, event.ownGoal ? "ownGoal" : "goal");
    } else if (event.kind === "yellowcard" || event.kind === "redcard") {
      record(event.playerId, event.kind);
    }
  }
  return bySide;
}

function IncidentMark({ kind, minute }: { kind: IncidentKind; minute?: string }) {
  const { label, symbol } = incidentTypes[kind];
  return (
    <span className={styles.incidentMark} data-incident={kind} title={minute ? `${label} at ${minute}` : label}>
      <span aria-hidden="true">{symbol}</span>
      {minute && <><span className={styles.srOnly}>{label} at </span>{minute}</>}
    </span>
  );
}

function Roster({ players, ratings, incidents }: {
  players: Player[];
  ratings: Map<string, LineupProfile> | null;
  incidents: Map<string, Incident[]>;
}) {
  return (
    <ul className={styles.roster} role="list">
      {players.map((player) => {
        const rating = ratings?.get(player.id)?.rating;
        return (
          <li key={player.id}>
            <span className={styles.shirt}>{player.number ?? "—"}</span>
            <span className={styles.playerName}>{player.name}{player.captain && <abbr title="Captain">C</abbr>}</span>
            <span className={styles.rosterIncidents}>
              {incidents.get(player.id)?.map(({ kind, minute }, index) => <IncidentMark key={index} kind={kind} minute={minute} />)}
            </span>
            {rating != null && <span className={styles.rating} aria-label={`Rating ${rating.toFixed(1)}`}>{rating.toFixed(1)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

async function LineupsPanel({ data, ratings, events, match }: {
  data: ReturnType<typeof getOverviewLineups>;
  ratings: ReturnType<typeof getLineupRatings>;
  events: ReturnType<typeof getMatchEvents>;
  match: Match;
}) {
  const lineups = await data;
  if (!lineups) return <p className={styles.notice}>Lineups are unavailable for this match.</p>;
  const [playerRatings, matchEvents] = await Promise.all([ratings, events]);
  const incidents = playerIncidents(matchEvents ?? []);
  const clubs = clubsFor(match);
  const showPitch = sides.every((side) => {
    const starters = lineups[side]?.starters;
    return starters?.length === 11 && starters.every((player) => player.position);
  });
  const pitchKinds = new Set(sides.flatMap((side) => lineups[side]?.starters.flatMap(({ id }) =>
    (incidents[side].get(id) ?? []).map(({ kind }) => kind)) ?? []));

  return (
    <section className={styles.panel} aria-labelledby="overview-lineups">
      <header className={styles.panelHeader}><h3 id="overview-lineups">Lineups</h3></header>
      {showPitch && (
        <div className={styles.formation}>
          <div className={styles.field} role="group" aria-label="Starting formation">
            <div className={styles.midfield} />
            <div className={styles.boxLeft} />
            <div className={styles.boxRight} />
            {sides.flatMap((side) => lineups[side]?.starters.map((player) => {
              if (!player.position) return null;
              const { x, y } = player.position;
              const left = side === "home" ? 4 + 45 * x : 96 - 45 * x;
              const top = 8 + 84 * (side === "home" ? y : 1 - y);
              const history = incidents[side].get(player.id) ?? [];
              const marks = [...new Set(history.map(({ kind }) => kind))];
              return (
                <FormationPlayer key={`${side}-${player.id}`} name={player.name} club={clubs[side].name}
                  number={player.number} captain={player.captain} profile={playerRatings?.get(player.id)} side={side} left={left} top={top}
                  history={history.map(({ kind, minute }) => `${incidentTypes[kind].label} ${minute}`)}>
                  <span className={styles.pitchNumber}>{player.number ?? "•"}</span>
                  {marks.length > 0 && <span className={styles.pitchIncidents}>
                    {marks.map((kind) => <IncidentMark key={kind} kind={kind} />)}
                  </span>}
                  <small>{player.name.split(/\s+/).at(-1)}</small>
                </FormationPlayer>
              );
            }) ?? [])}
          </div>
          {pitchKinds.size > 0 && (
            <ul className={styles.incidentLegend} aria-label="Pitch markers" role="list">
              {[...pitchKinds].map((kind) => <li key={kind}><IncidentMark kind={kind} />{incidentTypes[kind].label}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className={styles.lineupColumns}>
        {sides.map((side) => {
          const lineup = lineups[side];
          const club = clubs[side];
          const rosterEvents = incidents[side];
          const used = (lineup?.bench ?? []).filter(({ id }) => rosterEvents.get(id)?.some(({ kind }) => kind === "on"));
          const unused = (lineup?.bench ?? []).filter((player) => !used.includes(player));
          return (
            <section className={styles.lineup} data-side={side} key={side}>
              <header className={styles.lineupHeader}>
                <h4><ClubCrest name={club.name} src={club.crest} className={styles.smallCrest} /><span>{club.name}</span></h4>
                {lineup?.formation && <span className={styles.formationCode}>{lineup.formation}</span>}
                {lineup?.coach && <p>Coach {lineup.coach}</p>}
                {lineup?.confirmed != null && (
                  <span className={styles.lineupStatus} data-confirmed={lineup.confirmed}>
                    {lineup.confirmed && <span aria-hidden="true">✓ </span>}{lineup.confirmed ? "Confirmed" : "Unconfirmed"}
                  </span>
                )}
              </header>
              {lineup ? (
                <>
                  {lineup.starters.length > 0 && <><h5>Starting XI</h5><Roster players={lineup.starters} ratings={playerRatings} incidents={rosterEvents} /></>}
                  {used.length > 0 && <><h5>Substitutes used</h5><Roster players={used} ratings={playerRatings} incidents={rosterEvents} /></>}
                  {unused.length > 0 && <details className={styles.bench}><summary>Bench ({unused.length})</summary>
                    <Roster players={unused} ratings={playerRatings} incidents={rosterEvents} />
                  </details>}
                </>
              ) : <p className={styles.coach}>Lineup unavailable</p>}
            </section>
          );
        })}
      </div>
    </section>
  );
}

async function HeadToHeadPanel({ data, match }: { data: ReturnType<typeof getHeadToHead>; match: Match }) {
  const history = await data;
  if (!history) return <p className={styles.notice}>Head-to-head history is unavailable for this match.</p>;
  const clubs = clubsFor(match);
  const past = history.meetings.filter((meeting) => meeting.score)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 5);
  const next = history.meetings.filter((meeting) => !meeting.score)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const summary = history.summary;

  function teams(home: typeof sides[number], score: [number, number] | null) {
    const first = clubs[home];
    const second = clubs[home === "home" ? "away" : "home"];
    return (
      <div className={styles.meetingTeams}>
        <span>{first.name}<ClubCrest name={first.name} src={first.crest} className={styles.smallCrest} /></span>
        <strong>{score ? `${score[0]}–${score[1]}` : "vs"}</strong>
        <span><ClubCrest name={second.name} src={second.crest} className={styles.smallCrest} />{second.name}</span>
      </div>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="overview-h2h">
      <header className={styles.panelHeader}><h3 id="overview-h2h">Head-to-head</h3>
        {summary && <span>{summary.total_matches} {summary.total_matches === 1 ? "recorded meeting" : "recorded meetings"}</span>}
      </header>
      {summary && summary.total_matches > 0 && (
        <dl className={styles.historyTotals}>
          <div data-side="home"><dt>{match.home} wins</dt><dd>{summary.home_wins}</dd></div>
          <div><dt>Draws</dt><dd>{summary.draws}</dd></div>
          <div data-side="away"><dt>{match.away} wins</dt><dd>{summary.away_wins}</dd></div>
        </dl>
      )}
      {past.length > 0 ? (
        <ol className={styles.meetings} aria-label="Recent completed meetings" role="list">
          {past.map((meeting, index) => (
            <li key={`${meeting.kickoff}-${index}`}>
              <time dateTime={meeting.kickoff}>{date.format(new Date(meeting.kickoff))}</time>
              {teams(meeting.home, meeting.score)}
            </li>
          ))}
        </ol>
      ) : <p className={styles.notice}>No previous results are listed in the feed.</p>}
      {next && (
        <div className={styles.nextMeeting}>
          <h4>Next meeting</h4>
          <time dateTime={next.kickoff}>{date.format(new Date(next.kickoff))} · {kickoff.format(new Date(next.kickoff))}</time>
          {teams(next.home, null)}
        </div>
      )}
    </section>
  );
}

export function MatchOverview({ match, view }: { match: Match; view: "overview" | "stats" | "lineups" | "head-to-head" }) {
  const title = { overview: "Match overview", stats: "Stats", lineups: "Line-ups", "head-to-head": "Head-to-head" }[view];
  return (
    <section className={styles.overview} aria-labelledby="match-overview">
      <h2 id="match-overview">{title}</h2>
      {(view === "overview" || view === "stats") && <Suspense fallback={<p className={styles.notice} role="status">Loading team stats…</p>}>
        <StatsPanel data={getMatchStatPeriods(match.id)} match={match} full={view === "stats"} />
      </Suspense>}
      {view === "lineups" && <Suspense fallback={<p className={styles.notice} role="status">Loading lineups…</p>}>
        <LineupsPanel data={getOverviewLineups(match)} ratings={getLineupRatings(match)} events={getMatchEvents(match)} match={match} />
      </Suspense>}
      {view === "head-to-head" && <Suspense fallback={<p className={styles.notice} role="status">Loading head-to-head…</p>}>
        <HeadToHeadPanel data={getHeadToHead(match)} match={match} />
      </Suspense>}
    </section>
  );
}
