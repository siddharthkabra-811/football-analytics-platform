"use client";

import { useState, type CSSProperties } from "react";
import type { MatchStat } from "../../pitch-api";
import { ClubCrest } from "../../club-crest";
import { overviewMetrics as metrics } from "./overview-metrics";
import styles from "./overview.module.css";

const periods = [["All", "Full match"], ["FirstHalf", "1st half"], ["SecondHalf", "2nd half"]] as const;
type Period = { period: string; items: MatchStat[] };
type Club = { name: string; crest: string | null };

function read(value: string | null, kind: typeof metrics[number][2]) {
  const match = value?.match(kind === "passing" ? /^(\d+)(?:\s+\((\d+)%\))?$/ : /^(\d+(?:\.\d+)?)%?$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || (kind === "percent" && number > 100)) return null;
  const label = kind === "percent" ? `${number}%` : kind === "decimal" ? number.toFixed(2)
    : kind === "passing" && match[2] && Number(match[2]) <= 100 ? `${number.toLocaleString("en-GB")} (${match[2]}%)`
    : number.toLocaleString("en-GB");
  return { number, label };
}

export function OverviewStats({ data, home, away }: { data: Period[]; home: Club; away: Club }) {
  const available = periods.flatMap(([key, label]) => {
    const items = data.find((period) => period.period === key)?.items;
    if (!items) return [];
    const rows = metrics.flatMap(([metric, name, kind]) => {
      for (const item of items) {
        if (item.key !== metric) continue;
        const homeValue = read(item.home, kind);
        const awayValue = read(item.away, kind);
        if (homeValue || awayValue) return [{ metric, name, homeValue, awayValue }];
      }
      return [];
    });
    return rows.length ? [{ key, label, rows }] : [];
  });
  const [selected, setSelected] = useState(available[0]?.key);
  const period = available.find(({ key }) => key === selected) ?? available[0];

  if (!period) return <p className={styles.notice}>Team stats are unavailable for this match.</p>;

  return (
    <div className={styles.panel}>
      <header className={styles.panelHeader}>
        <h3>Top stats</h3>
        <div className={styles.periods} role="group" aria-label="Stats period">
          {available.map(({ key, label }) => (
            <button key={key} type="button" aria-pressed={period.key === key} onClick={() => setSelected(key)}>{label}</button>
          ))}
        </div>
      </header>
      <div className={styles.statsClubs}>
        <span><ClubCrest name={home.name} src={home.crest} className={styles.smallCrest} />{home.name}</span>
        <span>{away.name}<ClubCrest name={away.name} src={away.crest} className={styles.smallCrest} /></span>
      </div>
      <dl className={styles.metrics} aria-label={`${period.label} comparison, ${home.name} then ${away.name}`}>
        {period.rows.map(({ metric, name, homeValue, awayValue }) => {
          const sum = homeValue && awayValue ? homeValue.number + awayValue.number : 0;
          const share = sum > 0 && homeValue ? homeValue.number / sum * 100 : null;
          return (
            <div key={metric} className={styles.metric}>
              <dt>{name}</dt>
              <dd>
                <span className={styles.homeValue}>{homeValue?.label ?? "—"}</span>
                <span className={styles.awayValue}>{awayValue?.label ?? "—"}</span>
                <span className={styles.metricTrack} aria-hidden="true">
                  {share !== null && <span style={{ "--home-share": `${share}%` } as CSSProperties} />}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
