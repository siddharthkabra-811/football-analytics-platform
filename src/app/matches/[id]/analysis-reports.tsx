"use client";

import { Dropdown } from "./dropdown";

import { useState } from "react";
import type { AdvancedReport, PlayerReport } from "./analysis-data";
import { humanize, metricValue, type Teams } from "./analysis-visuals";
import styles from "./analysis.module.css";

const periodLabels: Record<string, string> = { All: "Full match", FirstHalf: "First half", SecondHalf: "Second half" };
const definitions: Record<string, string> = {
  possession_value: "xT estimates threat added by moving the ball. VAEP values actions by their effect on scoring and conceding probabilities. These are separate models.",
  creation: "Shot-creating actions are the two attacking actions before a shot. Goal-creating actions apply the same idea to goals.",
  defending: "PPDA counts opposition passes per defensive action in the pressing zone. Lower values indicate more frequent defensive actions relative to passes.",
  territory: "Field tilt compares each team’s share of final-third activity.",
  tempo: "Sequence time is in seconds. Direct speed measures progress toward goal in metres per second.",
  goalkeeping: "Shot stopping and distribution. A missing rate can mean there were no eligible attempts.",
};

export function PlayerReportsView({ reports, teams }: { reports: PlayerReport[]; teams: Teams }) {
  const [id, setId] = useState(reports[0].player.id);
  const [compareId, setCompareId] = useState("");
  const [period, setPeriod] = useState("All");
  const report = reports.find(({ player }) => player.id === id) ?? reports[0];
  const active = report.periods.find((entry) => entry.period === period) ?? report.periods[0];
  const opponent = reports.find(({ player }) => player.id === compareId && player.id !== report.player.id);
  const otherPeriod = opponent?.periods.find((entry) => entry.period === active.period);
  const playerOptions = (["home", "away"] as const).flatMap((side) => reports.filter((entry) => entry.side === side)
    .map(({ player }) => ({ id: player.id, label: player.name, group: teams[side] })));
  const groupLabels = [...new Set([...active.groups, ...(otherPeriod?.groups ?? [])].map(({ label }) => label))];
  return <div className={styles.panel}>
    <div className={styles.controls}>
      <Dropdown label="Player" filter value={report.player.id} onChange={setId} searchLabel="Search players" options={playerOptions} />
      {reports.length > 1 && <Dropdown label="Compare with" filter value={opponent?.player.id ?? ""} onChange={setCompareId}
        searchLabel="Search players" options={[{ id: "", label: "No comparison" }, ...playerOptions.filter(({ id }) => id !== report.player.id)]} />}
      <Dropdown label="Period" filter value={active.period} onChange={setPeriod}
        options={report.periods.map(({ period: id }) => ({ id, label: periodLabels[id] ?? humanize(id) }))} />
    </div>
    {opponent ? <div className={styles.comparisonHeader}><strong>{report.player.name}</strong><strong>{opponent.player.name}</strong></div> : <h3>{report.player.name}</h3>}
    {opponent && !otherPeriod && <p className={styles.note}>No {periodLabels[active.period]?.toLowerCase() ?? "matching period"} stats for {opponent.player.name}.</p>}
    {opponent ? groupLabels.map((label, index) => {
      const first = active.groups.find((group) => group.label === label)?.metrics ?? [];
      const second = otherPeriod?.groups.find((group) => group.label === label)?.metrics ?? [];
      const fields = new Map([...second, ...first].map((metric) => [metric.key, metric.label]));
      return <details key={label} open={index === 0 || undefined}>
        <summary>{label}</summary>
        <dl className={styles.compareMetrics} aria-label={`${report.player.name}, then ${opponent.player.name}`}>
          {[...fields].map(([key, name]) => <div key={key}>
            <dt>{name}</dt><dd><span>{first.find((metric) => metric.key === key)?.value ?? "—"}</span>
              <span>{second.find((metric) => metric.key === key)?.value ?? "—"}</span></dd>
          </div>)}
        </dl>
      </details>;
    }) : active.groups.map(({ label, metrics }, index) => <details key={`${label}:${index}`} open={index === 0 || undefined}>
      <summary>{label}</summary>
      <dl className={styles.metricGrid}>{metrics.map(({ key, value, label: name }, i) =>
        <div key={`${key}:${i}`}><dt>{name}</dt><dd>{value ?? "—"}</dd></div>)}</dl>
    </details>)}
  </div>;
}

function ReportMetrics({ report }: { report: AdvancedReport }) {
  return <div>
    <h3>{report.name}</h3>
    {report.groups.filter((group) => group.metrics.length > 0).map(({ label, metrics }, index) => <details key={label} open={index === 0 || undefined}>
      <summary>{humanize(label)}</summary>
      {definitions[label] && <p className={styles.note}>{definitions[label]}</p>}
      <dl className={styles.metricGrid}>{metrics.map(({ key, value }) =>
        <div key={key}><dt>{humanize(key)}</dt><dd>{metricValue(key, value)}</dd></div>)}</dl>
    </details>)}
  </div>;
}

export function AdvancedReportsView({ teams: teamReports, players, clubs, keepers = false }: {
  teams: AdvancedReport[];
  players: AdvancedReport[];
  clubs: Teams;
  keepers?: boolean;
}) {
  const [mode, setMode] = useState(teamReports.length ? "teams" : "players");
  const [id, setId] = useState(players[0]?.id);
  const player = players.find((entry) => entry.id === id) ?? players[0];
  const groups = [...new Set(teamReports.flatMap((entry) => entry.groups.map((group) => group.label)))];
  return <div className={styles.panel}>
    {!keepers && teamReports.length > 0 && players.length > 0 && <div className={styles.controls} role="group" aria-label="Advanced statistics level">
      <button type="button" aria-pressed={mode === "teams"} onClick={() => setMode("teams")}>Teams</button>
      <button type="button" aria-pressed={mode === "players"} onClick={() => setMode("players")}>Players</button>
    </div>}
    {mode === "teams" ? <>
      <div className={styles.comparisonHeader}><strong>{clubs.home}</strong><strong>{clubs.away}</strong></div>
      {groups.map((label, index) => {
        const home = teamReports.find((entry) => entry.side === "home")?.groups.find((group) => group.label === label)?.metrics ?? [];
        const away = teamReports.find((entry) => entry.side === "away")?.groups.find((group) => group.label === label)?.metrics ?? [];
        const keys = [...new Set([...home, ...away].map((metric) => metric.key))];
        return <details key={label} open={index === 0 || label === "possession_value" || undefined}>
          <summary>{humanize(label)}</summary>
          {definitions[label] && <p className={styles.note}>{definitions[label]}</p>}
          <dl className={styles.compareMetrics}>{keys.map((key) => <div key={key}>
            <dt>{humanize(key)}</dt>
            <dd><span>{metricValue(key, home.find((entry) => entry.key === key)?.value ?? null)}</span>
              <span>{metricValue(key, away.find((entry) => entry.key === key)?.value ?? null)}</span></dd>
          </div>)}</dl>
        </details>;
      })}
    </> : player && <>
      <Dropdown label={keepers ? "Goalkeeper" : "Player"} value={player.id} onChange={setId}
        searchLabel={keepers ? "Search goalkeepers" : "Search players"}
        options={(["home", "away"] as const).flatMap((side) => players.filter((entry) => entry.side === side)
          .map(({ id, name }) => ({ id, label: name, group: clubs[side] })))} />
      <ReportMetrics key={player.id} report={player} />
    </>}
  </div>;
}
