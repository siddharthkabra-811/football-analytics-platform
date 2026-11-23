import { useState, type CSSProperties, type MouseEvent } from "react";
import type { MatchShot } from "../../pitch-api";
import styles from "./shot-map.module.css";

function elapsed(shot: MatchShot) {
  // Keep first-half stoppage time before the first minute of the second half.
  return shot.minute + shot.added / (shot.added + 1);
}

export function XgTimeline({ shots, team, selectedId, onSelect }: {
  shots: MatchShot[];
  team: Record<MatchShot["side"], string>;
  selectedId: string;
  onSelect: (shot: MatchShot) => void;
}) {
  const [cursor, setCursor] = useState<number | null>(null);
  const totals = { home: 0, away: 0 };
  const unrated = { home: 0, away: 0 };
  const rated = { home: 0, away: 0 };
  const paths = { home: "M0 100", away: "M0 100" };
  const end = Math.max(90, ...shots.map(elapsed));
  const points = shots.map((shot) => {
    if (!shot.ownGoal) {
      if (shot.xg === null) unrated[shot.side]++;
      else rated[shot.side]++;
    }
    totals[shot.side] += shot.xg ?? 0;
    return { shot, minute: elapsed(shot), x: elapsed(shot) / end * 100, total: totals[shot.side] };
  });
  const ceiling = Math.max(1, Math.ceil(Math.max(totals.home, totals.away)));
  const y = (value: number) => 100 - value / ceiling * 100;
  const isUnavailable = (side: MatchShot["side"]) => unrated[side] > 0 && rated[side] === 0;

  if (!shots.some((shot) => shot.xg !== null)) return null;

  const samples = [...new Set([
    ...Array.from({ length: Math.min(150, Math.floor(end)) + 1 }, (_, minute) => minute),
    ...points.map(({ minute }) => minute),
  ])].sort((a, b) => a - b);
  const minute = samples[cursor ?? 0];
  const atCursor = { home: 0, away: 0 };
  const atMinute = {
    home: { attempts: 0, rated: 0, xg: 0 },
    away: { attempts: 0, rated: 0, xg: 0 },
  };
  const lastAtMinute = points.find(({ minute: time }) => time === minute)?.shot;

  for (const { shot, x, total } of points) {
    paths[shot.side] += `H${x}V${y(total)}`;
    const time = elapsed(shot);
    if (time <= minute) atCursor[shot.side] = total;
    if (time === minute && !shot.ownGoal) {
      atMinute[shot.side].attempts++;
      if (shot.xg !== null) {
        atMinute[shot.side].rated++;
        atMinute[shot.side].xg += shot.xg;
      }
    }
  }

  const minuteLabel = `${Math.floor(minute)}${lastAtMinute?.added ? `+${lastAtMinute.added}` : ""}′`;
  const cursorX = minute / end * 100;
  const runningXg = (side: MatchShot["side"]) => isUnavailable(side) ? "Unavailable" : atCursor[side].toFixed(2);
  const hasGoals = points.some(({ shot }) => shot.goal && !isUnavailable(shot.side));
  const activity = (side: MatchShot["side"]) => {
    const { attempts, rated, xg } = atMinute[side];
    if (!attempts) return "";
    const count = `${attempts} ${attempts === 1 ? "shot" : "shots"}`;
    if (rated === 0) return `${count} · xG unavailable`;
    return `${count} · +${xg.toFixed(2)} xG${rated < attempts ? " (partial)" : ""}`;
  };

  function inspectPointer(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const time = (event.clientX - bounds.left) / bounds.width * end;
    setCursor(samples.reduce((closest, sample, index) =>
      Math.abs(sample - time) < Math.abs(samples[closest] - time) ? index : closest, 0));
  }

  return (
    <section className={styles.timeline} aria-labelledby="xg-timeline-title">
      <h3 id="xg-timeline-title">Cumulative xG</h3>
      <p>Hover, tap, or use the arrow keys to compare running xG. Select a goal to see it on the pitch.</p>
      {shots.some((shot) => !shot.ownGoal && shot.xg === null) && <p>Shots without xG are excluded from the totals.</p>}
      <div className={styles.timelineChart}>
        <div className={styles.yAxis} aria-hidden="true"><span>{ceiling}</span><span>{ceiling / 2}</span><span>0</span></div>
        <div className={styles.timelinePlot}
          onPointerMove={(event) => { if (event.pointerType !== "touch") inspectPointer(event); }}
          onClick={inspectPointer}
          onPointerLeave={(event) => { if (event.pointerType !== "touch") setCursor(null); }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.chartGrid} d="M0 0H100M0 50H100M0 100H100" />
            {(["home", "away"] as const).map((side) => !isUnavailable(side)
              && <path key={side} className={styles.chartLine} data-side={side} d={paths[side] + "H100"} />)}
          </svg>
          <input className={styles.timelineScrubber} type="range" min={0} max={samples.length - 1}
            value={cursor ?? 0} aria-label="Inspect cumulative xG by match minute"
            aria-valuetext={`${minuteLabel}. ${(["home", "away"] as const).map((side) =>
              `${team[side]}: ${runningXg(side)}${activity(side) ? `, ${activity(side)}` : ""}`).join("; ")}`}
            onFocus={() => setCursor((index) => index ?? 0)} onBlur={() => setCursor(null)}
            onChange={(event) => setCursor(event.currentTarget.valueAsNumber)} />
          {cursor !== null && (
            <div className={styles.timelineReadout} aria-hidden="true" style={{ "--cursor-x": `${cursorX}%` } as CSSProperties}>
              <span className={styles.timelineGuide} />
            </div>
          )}
          {points.filter(({ shot }) => shot.goal && !isUnavailable(shot.side)).map(({ shot, x, total }) => (
            <button key={shot.id} type="button" data-side={shot.side} className={styles.timelineGoal}
              style={{ left: `${x}%`, top: `${y(total)}%` }} aria-pressed={selectedId === shot.id}
              aria-label={`${shot.minute}${shot.added ? `+${shot.added}` : ""}′ ${shot.outcome.toLowerCase()}, ${shot.player ?? team[shot.side]}`}
              onClick={(event) => {
                event.stopPropagation();
                setCursor(samples.indexOf(elapsed(shot)));
                onSelect(shot);
              }} />
          ))}
          <div className={styles.xAxis} aria-hidden="true">
            <span>0′</span><span style={{ left: `${45 / end * 100}%` }}>45′</span><span>FT</span>
          </div>
        </div>
      </div>
      <div className={styles.timelineTooltip} aria-hidden="true">
        <strong>{cursor === null ? "Full match · xG" : `${minuteLabel} · Running xG`}</strong>
        {(["home", "away"] as const).map((side) => (
          <div data-side={side} key={side}>
            <span>{team[side]}{cursor !== null && activity(side) && <small>{activity(side)}</small>}</span>
            <b>{cursor === null && !isUnavailable(side) ? totals[side].toFixed(2) : runningXg(side)}</b>
          </div>
        ))}
      </div>
      <div className={`${styles.legend} ${styles.timelineLegend}`}>
        {(["home", "away"] as const).map((side) => (
          <span data-side={side} key={side}>{team[side]} · {isUnavailable(side) ? "xG unavailable" : `${totals[side].toFixed(2)} xG`}</span>
        ))}
        {hasGoals && <span className={styles.goalKey}>Goal</span>}
      </div>
    </section>
  );
}
