"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./match.module.css";
import { matchViews, type MatchView } from "./match-views";

export function MatchSectionNav({ view, query, allowLegacyLink }: {
  view: MatchView;
  query: string;
  allowLegacyLink: boolean;
}) {
  const router = useRouter();
  const navigation = useRef<HTMLElement>(null);
  const path = (section: typeof view) => {
    const params = new URLSearchParams(query);
    params.set("view", section);
    return `?${params}`;
  };
  const overviewHref = path("overview");
  const timelineHref = path("timeline");
  const shotsHref = path("shots");
  const xgHref = path("xg");
  const lineupsHref = path("lineups");
  const historyHref = path("head-to-head");

  useEffect(() => {
    const hash = window.location.hash;
    if (allowLegacyLink && ["#shot-analysis", "#shot-details"].includes(hash)) {
      router.replace(`${shotsHref}${hash}`);
    } else if (allowLegacyLink && hash === "#match-timeline") {
      router.replace(`${timelineHref}${hash}`);
    } else if (allowLegacyLink && hash === "#xg-timeline-title") {
      router.replace(`${xgHref}${hash}`);
    } else if (allowLegacyLink && hash === "#overview-lineups") {
      router.replace(`${lineupsHref}${hash}`);
    } else if (allowLegacyLink && hash === "#overview-h2h") {
      router.replace(`${historyHref}${hash}`);
    }
  }, [allowLegacyLink, router, shotsHref, timelineHref, xgHref, lineupsHref, historyHref]);

  useEffect(() => {
    const rail = navigation.current;
    const active = rail?.querySelector('[aria-current="page"]');
    if (!rail || !active) return;
    const viewport = rail.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    if (target.left < viewport.left) rail.scrollLeft += target.left - viewport.left - 7;
    if (target.right > viewport.right) rail.scrollLeft += target.right - viewport.right + 7;
    if (target.top < viewport.top) rail.scrollTop += target.top - viewport.top - 7;
    if (target.bottom > viewport.bottom) rail.scrollTop += target.bottom - viewport.bottom + 7;
  }, [view]);

  return (
    <nav ref={navigation} className={styles.sectionNav} aria-label="Match sections">
      {matchViews.map((group) => <div key={group.label}>
        <p>{group.label}</p>
        {group.views.map(([id, label]) => <Link key={id} href={`${id === "overview" ? overviewHref : path(id)}#match-content`}
          prefetch={false} aria-current={view === id ? "page" : undefined}>{label}</Link>)}
      </div>)}
    </nav>
  );
}
