import Link from "next/link";
import filterStyles from "../match-date-filter.module.css";
import { getPremierLeagueResults, isMatchDate } from "../pitch-api";
import { SiteHeader } from "../site-header";
import { ClubCrest } from "../club-crest";
import { matchHref } from "../match-navigation";
import styles from "./results.module.css";
export const metadata = {
  title: "Premier League Results | Ninety Atlas",
  alternates: { canonical: "/results" },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeZone: "UTC",
});

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  const selectedDate = isMatchDate(date) ? date : undefined;
  const results = await getPremierLeagueResults();
  const matches = results?.filter((match) => !selectedDate || match.date === selectedDate) ?? [];
  const matchdays = Object.entries(Object.groupBy(matches, (match) => match.date))
    .sort(([first], [second]) => second.localeCompare(first));

  return (
    <div className={styles.page}>
      <div className={styles.masthead}>
        <SiteHeader onResults />
        <div className={`${styles.inner} ${styles.heading}`}>
          <p>Premier League</p>
          <h1>Match results</h1>
        </div>
      </div>
      <main className={styles.inner}>
        <div className={styles.toolbar}>
          <div className={styles.summary}>
            <h2>{selectedDate ? "Selected matchday" : "Season results"}</h2>
            {results !== null && <p>{matches.length} completed {matches.length === 1 ? "match" : "matches"}</p>}
          </div>
          {results !== null && (
            <form action="/results" method="get" className={filterStyles.filters}>
              <label htmlFor="match-date">Match date</label>
              <div className={filterStyles.controls}>
                <input key={selectedDate} type="date" name="date" id="match-date" defaultValue={selectedDate} required />
                <button type="submit">Show results</button>
                {selectedDate && <Link href="/results">All dates</Link>}
              </div>
            </form>
          )}
        </div>

        {matches.length > 0 ? (
          <div className={styles.matchdays}>
            {matchdays.map(([date, dayMatches]) => (
              <section key={date} aria-labelledby={`day-${date}`} className={styles.matchday}>
                <h3 id={`day-${date}`}>
                  <time dateTime={date}>{dateFormatter.format(new Date(`${date}T00:00:00Z`))}</time>
                </h3>
                <ul className={styles.matches} role="list">
                  {dayMatches?.map(({ id, home, away, homeCrest, awayCrest, score }) => (
                    <li key={id}>
                      <Link className={styles.match} href={matchHref(id, "results", selectedDate)} prefetch={false}
                        aria-label={`View match: ${home} ${score[0]} to ${score[1]} ${away}`}>
                        <div className={styles.team}><ClubCrest name={home} src={homeCrest} className={styles.crest} /><span>{home}</span></div>
                        <div className={styles.score}>
                          <span className={styles.scoreValue}>{score[0]}&ndash;{score[1]}</span>
                          <span className={styles.status}>Full time</span>
                        </div>
                        <div className={styles.team}><span>{away}</span><ClubCrest name={away} src={awayCrest} className={styles.crest} /></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>{results === null
            ? "Premier League results are currently unavailable."
            : selectedDate ? "No completed Premier League matches on this date."
            : "No completed Premier League matches are available this season."}</p>
        )}
      </main>
    </div>
  );
}
