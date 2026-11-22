"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./match.module.css";

export function MatchSectionNav({ view, query, allowLegacyLink }: {
  view: "overview" | "timeline" | "shots";
  query: string;
  allowLegacyLink: boolean;
}) {
  const router = useRouter();
  const path = (section: typeof view) => {
    const params = new URLSearchParams(query);
    params.set("view", section);
    return `?${params}`;
  };
  const overviewHref = path("overview");
  const timelineHref = path("timeline");
  const shotsHref = path("shots");

  useEffect(() => {
    const hash = window.location.hash;
    if (allowLegacyLink && ["#shot-analysis", "#xg-timeline-title", "#shot-details"].includes(hash)) {
      router.replace(`${shotsHref}${hash}`);
    } else if (allowLegacyLink && hash === "#match-timeline") {
      router.replace(`${timelineHref}${hash}`);
    }
  }, [allowLegacyLink, router, shotsHref, timelineHref]);

  return (
    <nav className={styles.sectionNav} aria-label="Match sections">
      <Link href={`${overviewHref}#match-content`} prefetch={false} aria-current={view === "overview" ? "page" : undefined}>Overview</Link>
      <Link href={`${timelineHref}#match-content`} aria-current={view === "timeline" ? "page" : undefined}>Match timeline</Link>
      <Link href={`${shotsHref}#match-content`} aria-current={view === "shots" ? "page" : undefined}>Shot analysis</Link>
    </nav>
  );
}
