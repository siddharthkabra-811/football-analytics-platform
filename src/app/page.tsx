import type { Metadata } from "next";
import { brand } from "./brand";
import styles from "./home.module.css";
import { RecentResults } from "./recent-results";
import { SiteHeader } from "./site-header";

const matchesTarget = "#recent-results";

type HomePageProps = {
  searchParams: Promise<{ date?: string | string[] }>;
};

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage({ searchParams }: HomePageProps) {
  const { date } = await searchParams;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.artwork} aria-hidden="true" />
          <div className={styles.heroInner}>
            <p className={styles.heroCategory}>{brand.description}</p>
            <h1 id="home-title" className={styles.title}>
              <span className={styles.titleLead}>See the story</span>{" "}
              <span>behind the score.</span>
            </h1>
            <p className={styles.description}>
              Explore the chances that shaped a match, one shot at a time.
            </p>
            <a className={styles.browseLink} href={matchesTarget}>
              Explore results <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <RecentResults date={date} />
      </main>
    </div>
  );
}
