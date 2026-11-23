import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { ClubCrest } from "../../club-crest";
import { getMatchBannerDetails, getMatchEvents, getMatchShots, getPremierLeagueResults, getShootingStats, isMatchDate, type MatchShot, type ShootingStats } from "../../pitch-api";
import { SiteHeader } from "../../site-header";
import { kickoffLight, venueLocation } from "./kickoff-light";
import styles from "./match.module.css";
import { MatchTimeline } from "./match-timeline";
import { MatchOverview } from "./match-overview";
import { resolveMatchView } from "./match-views";
import { ExtraAnalysis } from "./extra-analysis";
import { MatchSectionNav } from "./match-section-nav";
import timelineStyles from "./match-timeline.module.css";
import { ShotMap } from "./shot-map";
import shotStyles from "./shot-map.module.css";

export const metadata = { title: "Match Overview | Ninety Atlas" };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" });
const kickoffFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", timeZoneName: "short",
});

const sparkAngles = [8, 37, 69, 103, 135, 166, 197, 225, 257, 288, 320, 348];

function WinnerBurst() {
  return (
    <span className={styles.winnerBurst} aria-hidden="true">
      {sparkAngles.map((angle) => <i key={angle} style={{ "--spark-angle": `${angle}deg` } as CSSProperties} />)}
    </span>
  );
}

async function ShotAnalysis({ shots, stats, home, away, crests, shotId, view }: {
  shots: Promise<MatchShot[] | null>;
  stats: Promise<ShootingStats | null>;
  home: string;
  away: string;
  crests: { home: string | null; away: string | null };
  shotId?: string;
  view: "shots" | "xg";
}) {
  const data = await shots;
  if (!data?.length) {
    return <p className={shotStyles.notice}>{data === null
      ? "Shot data is currently unavailable for this match."
      : "No shots were recorded in the provider feed for this match."}</p>;
  }
  const selected = data.find((shot) => shot.id === shotId)?.id;
  return <ShotMap key={`${view}:${selected ?? ""}`} view={view} shots={data} stats={await stats} home={home} away={away} crests={crests} initialShotId={selected} />;
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[]; date?: string | string[]; shot?: string | string[]; view?: string | string[] }>;
}) {
  const [{ id }, { from, date, shot, view }] = await Promise.all([params, searchParams]);
  const activeView = resolveMatchView(view, shot);
  const results = await getPremierLeagueResults();
  const match = results?.find((result) => result.id === id);
  if (results !== null && !match) notFound();
  const shotView = activeView === "shots" || activeView === "xg" ? activeView : null;
  const shots = match && (shotView || activeView === "timeline") ? getMatchShots(match) : null;
  const events = match && activeView === "timeline" ? getMatchEvents(match) : null;
  const shootingStats = match && shotView ? getShootingStats(match.id) : null;
  const banner = match ? await getMatchBannerDetails(match.id) : null;
  const venue = venueLocation(banner?.stadium);
  const kickoff = banner?.kickoff ? new Date(banner.kickoff) : null;
  const light = kickoffLight(kickoff, venue);

  const fromHome = from === "home";
  const dateQuery = isMatchDate(date) ? `?date=${date}` : "";
  const backHref = fromHome ? `/${dateQuery}#recent-results` : `/results${dateQuery}`;
  const contextQuery = new URLSearchParams();
  if (from === "home" || from === "results") contextQuery.set("from", from);
  if (isMatchDate(date)) contextQuery.set("date", date);

  return (
    <div className={styles.page}>
      <SiteHeader onResults />
      <main className={styles.inner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href={backHref}>{fromHome ? "Recent results" : "Match results"}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Match overview</span>
        </nav>

        {match ? (
          <section className={styles.scoreboard} data-light={light} aria-labelledby="match-title">
            <header className={styles.context}>
              <div className={styles.competition}>
                {banner?.leagueLogo && <ClubCrest name="Premier League" src={banner.leagueLogo} className={styles.leagueLogo} />}
                <h1 id="match-title">Premier League</h1>
              </div>
              {(banner?.round || banner?.season) && (
                <p>{[banner.round && `Matchweek ${banner.round}`, banner.season].filter(Boolean).join(" · ")}</p>
              )}
              <time dateTime={match.date}>{dateFormatter.format(new Date(`${match.date}T00:00:00Z`))}</time>
            </header>
            <div className={styles.matchup}>
              <div className={styles.team}>
                <div className={styles.crestStage}>
                  {match.score[0] > match.score[1] && <WinnerBurst />}
                  <ClubCrest name={match.home} src={match.homeCrest} className={styles.crest} />
                </div>
                <strong>{match.home}</strong>
                <span>Home</span>
              </div>
              <div className={styles.result}>
                <div className={styles.score} aria-label={`${match.score[0]} to ${match.score[1]}`}>
                  <span>{match.score[0]}</span><span className={styles.separator}>&ndash;</span><span>{match.score[1]}</span>
                </div>
                <span className={styles.status}>Full time</span>
              </div>
              <div className={styles.team}>
                <div className={styles.crestStage}>
                  {match.score[1] > match.score[0] && <WinnerBurst />}
                  <ClubCrest name={match.away} src={match.awayCrest} className={styles.crest} />
                </div>
                <strong>{match.away}</strong>
                <span>Away</span>
              </div>
            </div>
            {(kickoff || banner?.stadium || banner?.referee) && (
              <dl className={styles.matchFacts}>
                {kickoff && <div><dt>Kickoff</dt><dd><time dateTime={kickoff.toISOString()}>{kickoffFormatter.format(kickoff)}</time></dd></div>}
                {banner?.stadium && <div><dt>Venue</dt><dd>{banner.stadium}{venue && <span>{venue.city}</span>}</dd></div>}
                {banner?.referee && <div><dt>Referee</dt><dd>{banner.referee}</dd></div>}
              </dl>
            )}
          </section>
        ) : (
          <section className={styles.unavailable}>
            <h1>Match overview</h1>
            <p>Match information is currently unavailable.</p>
          </section>
        )}
        {match && (
          <div id="match-content" className={styles.matchContent}>
            <MatchSectionNav view={activeView} query={contextQuery.toString()} allowLegacyLink={view === undefined && !shot} />
            <div className={styles.detailPane}>
              {(activeView === "overview" || activeView === "stats" || activeView === "lineups" || activeView === "head-to-head")
                && <MatchOverview match={match} view={activeView} />}
              {events && shots && (
                <section className={timelineStyles.section} aria-labelledby="match-timeline">
                  <h2 id="match-timeline">Match timeline</h2>
                  <Suspense fallback={<p className={timelineStyles.notice} role="status">Loading match events…</p>}>
                    <MatchTimeline events={events} shots={shots} home={match.home} away={match.away} query={contextQuery.toString()} />
                  </Suspense>
                </section>
              )}
              {shotView && shootingStats && shots && (
                <section className={shotStyles.section} aria-labelledby="shot-analysis">
                  <h2 id="shot-analysis">{shotView === "xg" ? "Expected goals" : "Shot analysis"}</h2>
                  <Suspense fallback={<p className={shotStyles.notice} role="status">Loading shot data…</p>}>
                    <ShotAnalysis view={shotView} shots={shots} stats={shootingStats} home={match.home} away={match.away}
                      crests={{ home: match.homeCrest, away: match.awayCrest }} shotId={typeof shot === "string" ? shot : undefined} />
                  </Suspense>
                </section>
              )}
              {(activeView === "momentum" || activeView === "players" || activeView === "passing" || activeView === "heatmaps"
                || activeView === "advanced" || activeView === "keepers" || activeView === "theatre")
                && <ExtraAnalysis view={activeView} match={match} query={contextQuery.toString()} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
