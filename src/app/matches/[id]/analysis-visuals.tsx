"use client";

import { Dropdown } from "./dropdown";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import type { HeatReport, PassNetwork } from "./analysis-data";
import styles from "./analysis.module.css";

export type Teams = { home: string; away: string };
export type ReplayStep = {
  id: string; minute: string; title: string; context: string; side: "home" | "away" | null;
  point: { x: number; y: number } | null; crossing: { x: number; y: number } | null;
  shotId?: string; highlight: boolean; xg: number | null; pressure?: number | null;
};

export function humanize(key: string) {
  const known: Record<string, string> = { xt_total: "Expected threat (xT)", vaep_total: "VAEP", pv_total: "Possession value", ppda: "PPDA",
    xag: "Expected assisted goals (xAG)", sca: "Shot-creating actions", gca: "Goal-creating actions" };
  return known[key] ?? key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function metricValue(key: string, value: number | null) {
  if (value === null) return "—";
  const unit = key.endsWith("_pct") || key.includes("accuracy") || key === "field_tilt" ? "%"
    : key === "direct_speed" ? " m/s" : key.endsWith("_distance") || key.endsWith("_x") ? " m"
    : key.endsWith("_time") ? " s" : "";
  return value.toLocaleString("en-GB", { maximumFractionDigits: 4 }) + unit;
}

function Pitch({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg className={styles.pitch} viewBox="0 0 105 68" role="img" aria-label={label}>
      <rect width="105" height="68" fill="#163932" />
      {children}
      <g className={styles.pitchLines}>
        <rect x=".2" y=".2" width="104.6" height="67.6" />
        <path d="M52.5 0V68M0 13.84H16.5V54.16H0M105 13.84H88.5V54.16H105M0 24.84H5.5V43.16H0M105 24.84H99.5V43.16H105" />
        <circle cx="52.5" cy="34" r="9.15" />
      </g>
    </svg>
  );
}

export function MomentumChart({ points, teams }: { points: { minute: number; value: number }[]; teams: Teams }) {
  const [index, setIndex] = useState(0);
  const selected = points[index] ?? points[0];
  const max = Math.max(.01, ...points.map(({ value }) => Math.abs(value)));
  const duration = Math.max(90, points.at(-1)?.minute ?? 90);
  const homePeak = points.reduce((peak, point) => point.value > peak.value ? point : peak, { minute: 0, value: 0 });
  const awayPeak = points.reduce((peak, point) => point.value < peak.value ? point : peak, { minute: 0, value: 0 });
  function inspect(event: MouseEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const minute = (local.x - 2) / 495 * duration;
    const nearest = points.reduce((best, point, i) =>
      Math.abs(point.minute - minute) < Math.abs(points[best].minute - minute) ? i : best, 0);
    setIndex(nearest);
  }
  return <div className={styles.panel}>
    <p className={styles.note}>Each bar is a snapshot of which team was applying more pressure. Taller bars indicate a stronger advantage for that team. The middle line means neither side had the edge.</p>
    <div className={styles.chartLegend}><span data-team="home">{teams.home} · above</span><span data-team="away">{teams.away} · below</span></div>
    <svg className={styles.momentum} viewBox="0 0 500 156" role="img" aria-label="Match pressure over time"
      onPointerMove={(event) => { if (event.pointerType !== "touch") inspect(event); }} onClick={inspect}>
      <path d="M0 78H500" stroke="#8296b8" strokeWidth="1" />
      {points.map(({ minute, value }, i) => {
        const height = Math.abs(value) / max * 72;
        return <rect key={i} x={2 + minute / duration * 495} y={value >= 0 ? 78 - height : 78} width={3.5} height={height}
          fill={value >= 0 ? "#dfff36" : "#8ab7ff"} opacity={i === index ? 1 : .68} />;
      })}
      <path d={`M${2 + selected.minute / duration * 495} 0V156`} stroke="#f4f7ff" strokeDasharray="3 4"/>
    </svg>
    <div className={styles.axis}><span>Kickoff</span><span>45′</span><span>Full time</span></div>
    <label className={styles.control}>Inspect pressure by minute
      <input type="range" min="0" max={points.length - 1} value={index} onChange={(e) => setIndex(e.currentTarget.valueAsNumber)}
        aria-valuetext={`${selected.minute} minutes, ${selected.value}`} />
    </label>
    <p className={styles.analysisReadout}><strong>{selected.minute.toLocaleString("en-GB")}′</strong> {selected.value === 0 ? "Neither team had the pressure advantage" : `${selected.value > 0 ? teams.home : teams.away} had the edge · ${Math.abs(selected.value).toFixed(2)} pressure index`}</p>
    <div className={styles.insightGrid}>{([["home", homePeak], ["away", awayPeak]] as const).map(([side, peak]) => (
      <div key={side}><strong>{teams[side]}</strong><span>{peak.value ? `Peak pressure at ${peak.minute.toLocaleString("en-GB")}′` : "No positive pressure advantage recorded"}</span></div>
    ))}</div>
  </div>;
}

export function HeatmapView({ length, width, reports, teams }: { length: number; width: number; reports: HeatReport[]; teams: Teams }) {
  const [id, setId] = useState(reports[0].id);
  const [cell, setCell] = useState<string | null>(null);
  const report = reports.find((entry) => entry.id === id) ?? reports[0];
  const peak = Math.max(1, ...report.cells.map((cell) => cell[2]));
  const colour = report.side === "home" ? "#dfff36" : "#8ab7ff";
  const ranked = [...report.cells].sort((a, b) => b[2] - a[2]);
  const active = report.cells.find(([x, y]) => `${x}:${y}` === cell);
  const area = (x: number, y: number) => {
    const thirds = ["Left third", "Middle third", "Right third"];
    const channels = ["upper flank", "upper channel", "centre", "lower channel", "lower flank"];
    return `${thirds[Math.floor(x / length * 3)]} · ${channels[Math.floor(y / width * 5)]}`;
  };
  return <div className={styles.panel}>
    <Dropdown label="Team or player" searchLabel="Search teams or players" value={report.id}
      onChange={(id) => { setId(id); setCell(null); }}
      options={[
        ...reports.filter((entry) => !entry.player).map(({ id, name }) => ({ id, label: name, group: "Teams" })),
        ...(["home", "away"] as const).flatMap((side) => reports.filter((entry) => entry.player && entry.side === side)
          .map(({ id, name }) => ({ id, label: name, group: teams[side] }))),
      ]} />
    <p className={styles.note}>{teams.away} attacks left · {teams.home} attacks right. Cell colours scale to the selected team or player.</p>
    <Pitch label={`Activity map for ${report.name}, ${report.actions ?? "unknown number of"} actions`}>
      {report.cells.map(([x, y, count]) => <rect key={`${x}:${y}`} x={105 * x / length} y={68 * y / width} width={105 / length} height={68 / width}
        fill={colour} fillOpacity={.12 + .8 * count / peak} stroke={cell === `${x}:${y}` ? "#fff" : undefined} strokeWidth=".6"
        onPointerEnter={() => setCell(`${x}:${y}`)} onClick={() => setCell(`${x}:${y}`)}>
        <title>{count} recorded actions</title>
      </rect>)}
    </Pitch>
    <div className={styles.heatLegend}>
      <span>Lower activity</span><span aria-hidden="true" style={{ background: `linear-gradient(90deg, #163932, ${colour})` }} /><span>Higher activity</span>
    </div>
    <p className={styles.analysisReadout}>{active ? <><strong>{area(active[0], active[1])}</strong> · {active[2]} recorded actions</>
      : report.actions === null ? "Action total unavailable" : `${report.actions} recorded actions. Explore an area on the pitch or in the list below.`}</p>
    <details open><summary>Most active areas</summary><p className={styles.note}>Focus or select an area to highlight its position on the pitch.</p>
      <ol className={styles.inspectList} role="list">{ranked.map(([x, y, count]) =>
        <li key={`${x}:${y}`}><button type="button" aria-pressed={cell === `${x}:${y}`}
          onPointerEnter={() => setCell(`${x}:${y}`)} onFocus={() => setCell(`${x}:${y}`)} onClick={() => setCell(`${x}:${y}`)}>
          {area(x, y)}<strong>{count} actions</strong></button></li>)}</ol>
    </details>
  </div>;
}

export function PassingView({ networks, teams }: { networks: PassNetwork[]; teams: Teams }) {
  const [side, setSide] = useState(networks[0].side);
  const [minimum, setMinimum] = useState(5);
  const [connection, setConnection] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const network = networks.find((entry) => entry.side === side) ?? networks[0];
  const nodes = new Map(network.nodes.map((node) => [node.player.id, node]));
  const edges = [...network.edges].sort((a, b) => b.passes - a.passes);
  const pathKey = (edge: PassNetwork["edges"][number]) => `${edge.from}:${edge.to}`;
  const active = edges.find((edge) => pathKey(edge) === connection);
  const currentPlayer = (playerId && nodes.get(playerId)) || network.nodes[0];
  const playerName = (id: string) => nodes.get(id)?.player.name ?? "Unknown player";
  const colour = network.side === "home" ? "#dfff36" : "#8ab7ff";
  return <div className={styles.panel}>
    <div className={styles.controls}>
      <Dropdown label="Club" filter value={network.side} onChange={(id) => {
        setSide(id === "home" ? "home" : "away"); setConnection(null); setPlayerId(null);
      }} options={networks.map(({ side }) => ({ id: side, label: teams[side] }))} />
      <Dropdown label="Minimum passes" filter value={String(minimum)} onChange={(id) => setMinimum(Number(id))}
        options={[1, 3, 5, 10, 15].map((count) => ({ id: String(count), label: String(count) }))} />
    </div>
    <p className={styles.note}>{network.window === "first_substitution" ? "Starting XI up to the team's first substitution" : "Recorded passing window"}
      {network.until === null ? "" : ` · through ${Math.floor(network.until / 60)}′`}. Arrows point to the receiver. Thicker lines show more passes.</p>
    <Pitch label={`Passing network for ${teams[network.side]}`}>
      <defs><marker id="pass-arrow" viewBox="0 0 5 5" refX="4" refY="2.5" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M0 0L5 2.5L0 5Z" fill={colour} />
      </marker></defs>
      {edges.filter((edge) => edge.passes >= minimum || pathKey(edge) === connection).map((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to || from.x === null || from.y === null || to.x === null || to.y === null) return null;
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        if (distance <= 4) return null;
        const dx = (to.x - from.x) / distance;
        const dy = (to.y - from.y) / distance;
        const path = `M${from.x + dx * 2.4} ${from.y + dy * 2.4} Q${(from.x + to.x) / 2 - dy * 3} ${(from.y + to.y) / 2 + dx * 3} ${to.x - dx * 3.2} ${to.y - dy * 3.2}`;
        const key = pathKey(edge);
        return <g key={key} onPointerEnter={() => setConnection(key)} onClick={() => setConnection(key)}>
          <path d={path} stroke="transparent" strokeWidth="2.2" fill="none" />
          <path d={path} stroke={colour} strokeOpacity={connection === key ? 1 : .45} strokeWidth={connection === key ? 1.3 : Math.min(.85, .16 + edge.passes / 34)}
            fill="none" markerEnd="url(#pass-arrow)" pointerEvents="none" />
        </g>;
      })}
      {network.nodes.map(({ player, x, y }) => x !== null && y !== null &&
        <g key={player.id}><circle cx={x} cy={y} r="2.3" fill={colour} stroke="#132037" strokeWidth=".4" />
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#10182b" fontSize="2.2" fontWeight="700">{player.number ?? "•"}</text>
          <title>{player.name}</title></g>)}
    </Pitch>
    <p className={styles.analysisReadout}>{active ? <><strong>{playerName(active.from)} → {playerName(active.to)}</strong> · {active.passes} {active.passes === 1 ? "pass" : "passes"}</>
      : "Point to an arrow or choose a connection below to see who passed to whom."}</p>
    <details open><summary>Who passed to whom ({edges.length})</summary>
      <p className={styles.note}>Ranked by number of passes. Receivers are inferred from the sequence of play.</p>
      <ol className={styles.inspectList} role="list">{edges.map((edge) => <li key={pathKey(edge)}>
        <button type="button" aria-pressed={connection === pathKey(edge)} onPointerEnter={() => setConnection(pathKey(edge))}
          onFocus={() => setConnection(pathKey(edge))} onClick={() => setConnection(pathKey(edge))}>
          {playerName(edge.from)} → {playerName(edge.to)} <strong>{edge.passes} {edge.passes === 1 ? "pass" : "passes"}</strong>
        </button>
      </li>)}</ol>
    </details>
    {currentPlayer && <details><summary>Player network metrics</summary>
      <section className={styles.networkCard} aria-label="Player role in the passing network">
        <Dropdown label="Choose a player" searchLabel="Search players" value={currentPlayer.player.id} onChange={setPlayerId}
          options={network.nodes.map(({ player }) => ({ id: player.id, label: player.name }))} />
        <p className={styles.note}>See passes made and received, plus how connected the player was in the recorded passing window.</p>
        <dl className={styles.metricGrid}>{currentPlayer.metrics.map(({ key, value }) => <div key={key}><dt>{humanize(key)}</dt><dd>{metricValue(key, value)}</dd></div>)}</dl>
      </section>
    </details>}
    <p className={styles.note}>Network centralization {metricValue("centralization", network.centralization)} · how concentrated the team’s passing was around a few players.</p>
  </div>;
}

export function TheatreReplay({ steps, teams, query }: { steps: ReplayStep[]; teams: Teams; query: string }) {
  const stage = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const highlights = steps.filter((step) => step.highlight);
  const [mode, setMode] = useState(highlights.length ? "highlights" : "all");
  const playlist = mode === "all" ? steps : highlights;
  const current = playlist[index];
  const shotQuery = new URLSearchParams(query);
  shotQuery.set("view", "shots");
  if (current.shotId) shotQuery.set("shot", current.shotId);
  useEffect(() => {
    if (!playing || index >= playlist.length - 1) return;
    const timer = window.setTimeout(() => {
      setIndex(index + 1);
      if (index + 1 === playlist.length - 1) setPlaying(false);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [index, playing, playlist.length]);
  useEffect(() => {
    const update = () => setExpanded(document.fullscreenElement === stage.current || stage.current?.matches(":modal") === true);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  function seek(value: number) {
    setPlaying(false);
    setIndex(Math.min(playlist.length - 1, Math.max(0, value)));
  }
  async function fullscreen() {
    const dialog = stage.current;
    if (!dialog) return;
    if (document.fullscreenElement === dialog) {
      await document.exitFullscreen();
      return;
    }
    if (dialog.matches(":modal")) {
      dialog.close();
      dialog.show();
      setExpanded(false);
      return;
    }

    if (dialog.requestFullscreen && document.fullscreenEnabled) {
      try {
        await dialog.requestFullscreen();
        return;
      } catch {
        // Embedded browsers can deny native full screen.
      }
    }
    dialog.close();
    dialog.showModal();
    setExpanded(true);
  }
  return <dialog open className={`${styles.panel} ${styles.theatre}`} ref={stage} aria-label="Match replay"
    onCancel={(event) => { event.preventDefault(); void fullscreen(); }}>
    <div className={styles.replayHeader}><p className={styles.note}>Match highlights · event reconstruction</p>
      <button type="button" onClick={fullscreen}>{expanded ? "Exit full screen" : "Full screen"}</button></div>
    <div className={styles.controls} role="group" aria-label="Replay scope">
      {highlights.length > 0 && <button type="button" aria-pressed={mode === "highlights"} onClick={() => { setMode("highlights"); seek(0); }}>Key moments</button>}
      <button type="button" aria-pressed={mode === "all"} onClick={() => { setMode("all"); seek(0); }}>All events</button>
    </div>
    <div className={styles.replayLayout}>
    {current.point ? <Pitch label={current.crossing ? "Shot origin and goal-line crossing" : "Recorded shot location"}>
      {current.crossing && <path d={`M${current.point.x} ${current.point.y}L${current.crossing.x} ${current.crossing.y}`}
        stroke="#e4eefd" strokeDasharray="1.4 1" strokeWidth=".55"/>}
      <circle className={styles.replayMarker} key={current.id} cx={current.point.x} cy={current.point.y} r="2.2"
        fill={current.side === "away" ? "#8ab7ff" : "#dfff36"} stroke="#f4f7ff" strokeWidth=".4" />
    </Pitch> : <div className={styles.replayInterlude}><span>{current.minute}</span><strong>{current.title}</strong><p>{current.context}</p></div>}
    <ol className={styles.inspectList} aria-label="Replay chapters" role="list">
      {playlist.map((step, i) => <li key={step.id}><button type="button" aria-pressed={index === i}
        onClick={() => seek(i)}><span>{step.minute} · {step.title}</span><strong>{step.side && teams[step.side]}</strong></button></li>)}
    </ol>
    </div>
    <div className={styles.replayEvent} aria-live={playing ? "off" : "polite"}>
      <span>{current.minute}</span><div><h3>{current.title}</h3><p>{current.context}</p></div>
    </div>
    {(current.xg !== null || current.pressure != null) && <div className={styles.replayContext}>
      {current.xg !== null && <span>Chance quality <strong>{current.xg.toFixed(2)} xG</strong></span>}
      {current.pressure != null && <span>Pressure near this moment <strong>{current.pressure === 0 ? "Even" : current.pressure > 0 ? teams.home : teams.away}</strong></span>}
      {current.crossing && <span>Dashed line connects recorded start and crossing points.</span>}
    </div>}
    <label className={styles.control}>Replay event {index + 1} of {playlist.length}
      <input type="range" min="0" max={playlist.length - 1} value={index} aria-valuetext={`${current.minute} ${current.title}`}
        onChange={(e) => seek(e.currentTarget.valueAsNumber)} /></label>
    <div className={styles.controls}>
      <button type="button" onClick={() => seek(index - 1)} disabled={index === 0}>Previous</button>
      <button type="button" disabled={playlist.length < 2} onClick={() => {
        if (!playing && index === playlist.length - 1) setIndex(0);
        setPlaying(!playing);
      }}>{playing ? "Pause" : "Play"}</button>
      <button type="button" onClick={() => seek(index + 1)} disabled={index === playlist.length - 1}>Next</button>
      {current.shotId && <Link href={`?${shotQuery}#shot-details`} prefetch={false}
        onNavigate={() => { if (expanded) void fullscreen(); }}>View shot</Link>}
    </div>
  </dialog>;
}
