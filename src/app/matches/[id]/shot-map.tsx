"use client";

import { useState } from "react";
import { ClubCrest } from "../../club-crest";
import type { MatchShot, ShootingStats } from "../../pitch-api";
import styles from "./shot-map.module.css";
import { XgTimeline } from "./xg-timeline";

const sides = ["home", "away"] as const;
const periods = [
  ["FirstHalf", "First half"],
  ["SecondHalf", "Second half"],
  ["ExtraTimeFirstHalf", "Extra time, first half"],
  ["ExtraTimeSecondHalf", "Extra time, second half"],
] as const;
type Filter = "all" | typeof sides[number];

function pitchPosition(side: MatchShot["side"], x: number, y: number) {
  return side === "home" ? { x, y } : { x: 105 - x, y: 68 - y };
}

function minuteLabel(shot: MatchShot) {
  return `${shot.minute}${shot.added ? `+${shot.added}` : ""}′`;
}

function GoalPlacement({ lateral, height }: NonNullable<MatchShot["placement"]>) {
  const halfWidth = Math.max(5.6, Math.abs(lateral) + .6);
  const top = Math.max(3.3, height + .55);
  const offset = Math.abs(lateral);
  const location = offset < .005 ? "centered" : `${offset.toFixed(2)} m from center`;

  return (
    <figure className={styles.placement}>
      <figcaption>Goal-line placement</figcaption>
      <svg viewBox={`${-halfWidth} ${-top} ${halfWidth * 2} ${top + .55}`} aria-hidden="true">
        <path d="M-3.66 0v-2.44h7.32V0" className={styles.goalFrame} />
        <line x1={-halfWidth} y1="0" x2={halfWidth} y2="0" className={styles.goalGround} />
        <circle cx={lateral} cy={-height} r=".13" className={styles.goalBall} />
      </svg>
      <p>{height.toFixed(2)} m high · {location}</p>
    </figure>
  );
}

export function ShotMap({ shots, stats, home, away, crests, initialShotId = "" }: {
  shots: MatchShot[];
  stats: ShootingStats | null;
  home: string;
  away: string;
  crests: Record<MatchShot["side"], string | null>;
  initialShotId?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [goalsOnly, setGoalsOnly] = useState(false);
  const [period, setPeriod] = useState("");
  const [selectedId, setSelectedId] = useState(initialShotId);
  const team = { home, away };
  const availablePeriods = periods.filter(([key]) => shots.some((shot) => shot.period === key));
  const visible = shots.filter((shot) => (filter === "all" || shot.side === filter)
    && (!goalsOnly || shot.goal) && (!period || shot.period === period));
  const selected = visible.find((shot) => shot.id === selectedId);
  const blockPath = selected?.block ? {
    start: pitchPosition(selected.side, selected.x, selected.y),
    end: pitchPosition(selected.side, selected.block.x, selected.block.y),
  } : null;

  return (
    <>
      <div className={styles.comparison}>
        {sides.map((side) => {
          const attempts = shots.filter((shot) => shot.side === side && !shot.ownGoal);
          const rated = attempts.filter((shot) => shot.xg !== null);
          const total = rated.reduce((sum, shot) => sum + (shot.xg ?? 0), 0);
          return (
            <div className={styles.teamSummary} data-side={side} key={side}>
              <header className={styles.summaryHeading}>
                <ClubCrest name={team[side]} src={crests[side]} className={styles.summaryCrest} />
                <h3>{team[side]}</h3>
              </header>
              <dl className={styles.primaryMetrics} data-columns={stats?.onTarget ? 3 : 2}>
                <div><dt>Shots</dt><dd>{attempts.length}</dd></div>
                {stats?.onTarget && <div><dt>On target</dt><dd>{stats.onTarget[side] ?? "—"}</dd></div>}
                <div><dt>xG</dt><dd>{rated.length || !attempts.length ? total.toFixed(2) : "—"}</dd></div>
              </dl>
              {(stats?.openPlayXg || stats?.setPlayXg) && (
                <dl className={styles.xgBreakdown}>
                  {stats.openPlayXg && <div><dt>Open-play xG</dt><dd>{stats.openPlayXg[side]?.toFixed(2) ?? "—"}</dd></div>}
                  {stats.setPlayXg && <div><dt>Set-play xG</dt><dd>{stats.setPlayXg[side]?.toFixed(2) ?? "—"}</dd></div>}
                </dl>
              )}
              {rated.length < attempts.length && <p>xG available for {rated.length} of {attempts.length} shots</p>}
            </div>
          );
        })}
      </div>
      <p className={styles.definition}>Expected goals (xG) estimates how likely each shot was to score. The chart sums shot values.
        {(stats?.openPlayXg || stats?.setPlayXg) && " Open-play and set-play figures come from PitchAPI’s match totals."}</p>
      <XgTimeline shots={shots} team={team} selectedId={selected?.id ?? ""}
        onSelect={(shot) => {
          if (filter !== "all" && filter !== shot.side) setFilter("all");
          if (period && period !== shot.period) setPeriod("");
          setSelectedId(shot.id);
        }} />

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label="Filter shots by team">
            {(["all", ...sides] as const).map((value) => (
              <button type="button" key={value} aria-pressed={filter === value}
                onClick={() => { setFilter(value); setSelectedId(""); }}>
                {value === "all" ? "All shots" : team[value]}
              </button>
            ))}
          </div>
          <div className={styles.mapFilters}>
            {availablePeriods.length > 1 && (
              <select aria-label="Match period" value={period} onChange={(event) => {
                const value = event.currentTarget.value;
                if (value && selected?.period !== value) setSelectedId("");
                setPeriod(value);
              }}>
                <option value="">All periods</option>
                {availablePeriods.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            )}
            <button type="button" className={styles.goalsFilter} aria-pressed={goalsOnly} onClick={() => {
              if (!goalsOnly && selected && !selected.goal) setSelectedId("");
              setGoalsOnly(!goalsOnly);
            }}>
              Goals only
            </button>
          </div>
        </div>
        <p className={styles.shotCount} role="status">{visible.length} of {shots.length} events shown</p>

        <div className={styles.analysis}>
          <div className={styles.map}>
            <p className={styles.direction} id="shot-map-direction">
              <span data-side="away" aria-label={`${away} attacks left`}>← {away}</span>
              <span data-side="home" aria-label={`${home} attacks right`}>{home} →</span>
            </p>
            <div className={styles.pitch} aria-label="Shot positions" aria-describedby="shot-map-direction" role="group">
              <svg viewBox="0 0 105 68" aria-hidden="true" fill="none" className={styles.lines}>
                <rect x=".15" y=".15" width="104.7" height="67.7" />
                <path d="M52.5 0v68M0 13.84h16.5v40.32H0m105-40.32H88.5v40.32H105M0 24.84h5.5v18.32H0m105-18.32h-5.5v18.32H105M16.5 26.69a9.15 9.15 0 0 1 0 14.62m72-14.62a9.15 9.15 0 0 0 0 14.62" />
                <circle cx="52.5" cy="34" r="9.15" />
                <path d="M11 34h.01m41.49 0h.01M94 34h.01" strokeLinecap="round" strokeWidth=".7" />
                {blockPath && (
                  <g className={styles.blockPath}>
                    <line x1={blockPath.start.x} y1={blockPath.start.y} x2={blockPath.end.x} y2={blockPath.end.y} />
                    <circle cx={blockPath.end.x} cy={blockPath.end.y} r=".8" />
                  </g>
                )}
              </svg>
              {visible.map((shot) => {
                const { x, y } = pitchPosition(shot.side, shot.x, shot.y);
                return <button type="button" key={shot.id} className={styles.marker} data-side={shot.side} data-goal={shot.goal}
                  aria-label={`${minuteLabel(shot)} ${shot.player ?? team[shot.side]}, ${shot.outcome}`}
                  aria-pressed={selectedId === shot.id}
                  style={{ left: `${x / 105 * 100}%`, top: `${y / 68 * 100}%` }}
                  onClick={() => setSelectedId(shot.id)} />;
              })}
            </div>
            <div className={styles.legend}>
              <span data-side="home">{home}</span>
              <span data-side="away">{away}</span>
              <span className={styles.goalKey}>Goal</span>
              {selected?.block && <span className={styles.blockKey}>{selected.outcome === "Cleared off the line" ? "Clearance point" : "Block point"}</span>}
            </div>
          </div>

          <div className={styles.inspector} id="shot-details">
            <label htmlFor="shot-selection">Shot details</label>
            <select id="shot-selection" value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)} disabled={!visible.length}>
              <option value="">{visible.length ? "Select a shot" : "No matching shots"}</option>
              {visible.map((shot) => (
                <option key={shot.id} value={shot.id}>{minuteLabel(shot)} {shot.player ?? team[shot.side]} · {shot.outcome}</option>
              ))}
            </select>
            <div className={styles.detail} aria-live="polite">
              {selected ? (
                <>
                  <p>{team[selected.side]} · {minuteLabel(selected)}</p>
                  <h3>{selected.player ?? "Player unavailable"}</h3>
                  <dl>
                    <div><dt>Outcome</dt><dd>{selected.outcome}</dd></div>
                    {!selected.ownGoal && <div><dt>xG</dt><dd>{selected.xg?.toFixed(2) ?? "Unavailable"}</dd></div>}
                    {selected.xgot !== null && <div><dt>xG on target</dt><dd>{selected.xgot.toFixed(2)}</dd></div>}
                    {selected.situation && <div><dt>Chance origin</dt><dd>{selected.situation}</dd></div>}
                    {selected.technique && <div><dt>Struck with</dt><dd>{selected.technique}</dd></div>}
                    {selected.insideBox !== null && <div><dt>Shot location</dt><dd>{selected.insideBox ? "Inside the box" : "Outside the box"}</dd></div>}
                    {selected.keeper && <div><dt>Goalkeeper</dt><dd>{selected.keeper}</dd></div>}
                  </dl>
                  {selected.placement && <GoalPlacement {...selected.placement} />}
                </>
              ) : <p>{visible.length ? "Choose a marker or select a shot to see the details."
                : "No shots match the current filters."}</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
