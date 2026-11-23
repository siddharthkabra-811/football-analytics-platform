import Link from "next/link";
import type { MatchEvent, MatchShot } from "../../pitch-api";
import styles from "./match-timeline.module.css";

const eventLabels = {
  goal: "Goal",
  substitution: "Substitution",
  yellowcard: "Yellow card",
  redcard: "Red card",
  penalty: "Penalty",
};

export function linkedShot(event: MatchEvent, events: MatchEvent[], shots: MatchShot[]) {
  if (event.kind !== "goal" || event.ownGoal || !event.playerId || !event.side) return undefined;

  const playerGoals = events.filter((entry) => entry.kind === "goal" && !entry.ownGoal
    && entry.playerId === event.playerId && entry.side === event.side);
  const candidates = shots.filter((shot) => shot.goal && !shot.ownGoal
    && shot.playerId === event.playerId && shot.side === event.side);
  const exact = candidates.filter((shot) => shot.minute === event.minute && shot.added === event.added);
  if (exact.length === 1 && playerGoals.filter((goal) => goal.minute === event.minute && goal.added === event.added).length === 1) {
    return exact[0];
  }

  // The provider’s two feeds can be one minute apart. Only accept that
  // difference if this player has exactly one goal in each feed.
  const [candidate] = candidates;
  if (playerGoals.length === 1 && candidates.length === 1 && !event.added && !candidate.added
    && Math.abs(candidate.minute - event.minute) === 1) return candidate;
}

export async function MatchTimeline({ events, shots, home, away, query }: {
  events: Promise<MatchEvent[] | null>;
  shots: Promise<MatchShot[] | null>;
  home: string;
  away: string;
  query: string;
}) {
  const entries = await events;
  if (!entries?.length) return <p className={styles.notice}>{entries === null
    ? "Match events are currently unavailable."
    : "No timeline events were recorded for this match."}</p>;

  const attempts = await shots ?? [];
  const teams = { home, away };

  return (
    <ol className={styles.events} role="list">
      {entries.map((event, index) => {
        const minute = `${event.minute}${event.added ? `+${event.added}` : ""}′`;
        const shot = linkedShot(event, entries, attempts);
        const badge = event.kind === "goal" && event.ownGoal ? "Own goal"
          : event.kind === "goal" && event.penalty ? "Penalty goal" : eventLabels[event.kind];
        const params = new URLSearchParams(query);
        if (shot) {
          params.set("view", "shots");
          params.set("shot", shot.id);
        }
        const club = event.side ? teams[event.side] : null;

        return (
          <li className={styles.event} key={index} data-kind={event.kind}>
            <span className={styles.minute}>{minute}</span>
            <span className={styles.badge}>{badge}</span>
            <div className={styles.content}>
              {event.kind === "substitution" ? (
                <p className={styles.players}>
                  {event.replacement && <span><small>On</small> {event.replacement}</span>}
                  {event.player && <span><small>Off</small> {event.player}</span>}
                  {!event.replacement && !event.player && <span>Players unavailable</span>}
                </p>
              ) : <p>{event.player ?? "Player unavailable"}</p>}
            </div>
            <span className={styles.club}>{club}</span>
            {shot && (
              <Link className={styles.shotLink} href={`?${params}#shot-details`} prefetch={false}
                aria-label={`View ${event.player ?? "player"}’s shot at ${minute}`}>
                View shot <span aria-hidden="true">↗</span>
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
