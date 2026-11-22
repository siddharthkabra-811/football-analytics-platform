import Link from "next/link";
import filterStyles from "./match-date-filter.module.css";
import { ClubCrest } from "./club-crest";
import { matchHref } from "./match-navigation";
import { getPremierLeagueResults, isMatchDate } from "./pitch-api";
import styles from "./recent-results.module.css";
import { ResultsMotion } from "./results-motion";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeZone: "UTC",
});

function Team({ name, crest }: { name: string; crest: string | null }) {
  return (
    <span className={styles.team}>
      <ClubCrest name={name} src={crest} className={styles.teamBadge} />
      <span className={styles.teamName}>{name}</span>
    </span>
  );
}

export async function RecentResults({ date }: { date?: string | string[] }) {
  const results = await getPremierLeagueResults();
  const dates = [...new Set(results?.map((match) => match.date))].sort().reverse();
  const latestDate = dates[0];
  const selectedDate = isMatchDate(date) ? date : latestDate;
  const matches = results?.filter((match) => match.date === selectedDate) ?? [];
  const dateLabel = selectedDate ? dateFormatter.format(new Date(`${selectedDate}T00:00:00Z`)) : null;
  const preview = matches.slice(0, 6);

  return (
    <section id="recent-results" className={styles.section} aria-labelledby="results-title" tabIndex={-1}>
      {selectedDate && <ResultsMotion date={selectedDate} />}
      <svg className={styles.pitchReveal} viewBox="0 0 680 320" fill="none" aria-hidden="true" focusable="false">
        <path className={styles.trajectory} d="M681 27C584 26 477 60 393 117S268 234 182 284" pathLength="1" />
        <g className={styles.pitchLines}>
          <path d="M215 77h440v196H215zM435 77v196M215 126h76v98h-76m440-98h-76v98h76" />
          <circle cx="435" cy="175" r="39" />
          <circle cx="435" cy="175" r="2" fill="currentColor" />
        </g>
      </svg>
      <div className={styles.inner}>
        <div className={styles.header}>
          <p className={styles.competition}>Premier League</p>
          <div className={styles.headingRow}>
            <h2 id="results-title" className={styles.heading} data-results-heading>Recent results</h2>
            {results !== null && (
              <form className={`${styles.dateForm} ${filterStyles.filters}`} action="/#recent-results" method="get">
                <label htmlFor="results-date">Match date</label>
                <div className={filterStyles.controls}>
                  <input key={selectedDate} id="results-date" name="date" type="date" defaultValue={selectedDate} required />
                  <button type="submit">Show results</button>
                </div>
              </form>
            )}
          </div>
        </div>
        {results !== null && selectedDate && <div className={styles.matchdayLabel}>
          <h3><time dateTime={selectedDate}>{dateLabel}</time></h3>
          <span>{preview.length < matches.length ? `${preview.length} of ` : ""}{matches.length} {matches.length === 1 ? "match" : "matches"}</span>
        </div>}
        {matches.length > 0 ? (
          <ul className={styles.matchGrid} role="list">
            {preview.map(({ id, home, away, homeCrest, awayCrest, score }) => (
              <li className={styles.matchCard} key={id} data-result-card>
                <Link className={styles.matchLink} href={matchHref(id, "home", isMatchDate(date) ? date : undefined)} prefetch={false}
                  aria-label={`View match: ${home} ${score[0]} to ${score[1]} ${away}`}>
                  <span className={styles.finalStatus}>Full time</span>
                  <div className={styles.matchup}>
                    <Team name={home} crest={homeCrest} />
                    <span className={styles.score}>
                      <span className={styles.visuallyHidden}>{score[0]} to {score[1]}</span>
                      <span aria-hidden="true" data-score-home={score[0]}>{score[0]}</span>
                      <span className={styles.scoreSeparator} aria-hidden="true">V/s</span>
                      <span aria-hidden="true" data-score-away={score[1]}>{score[1]}</span>
                    </span>
                    <Team name={away} crest={awayCrest} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyResults}>
            <p>{results === null ? "Premier League results are currently unavailable."
              : selectedDate ? "No completed Premier League matches on this date."
              : "No completed Premier League matches are available this season."}</p>
            {latestDate && selectedDate !== latestDate && <Link href="/#recent-results">Back to the latest matchday</Link>}
          </div>
        )}
        {latestDate && (
          <div className={styles.more}>
            <a href={selectedDate && selectedDate !== latestDate ? `/results?date=${selectedDate}` : "/results"}>
              Show more <span aria-hidden="true">→</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
