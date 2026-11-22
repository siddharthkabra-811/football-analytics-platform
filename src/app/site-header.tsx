import Image from "next/image";
import Link from "next/link";
import { brand } from "./brand";
import styles from "./home.module.css";

export function SiteHeader({ onResults = false }: { onResults?: boolean }) {
  return (
    <header className={onResults ? `${styles.header} ${styles.resultsHeader}` : styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/">
          <Image src={brand.mark} alt="" width={48} height={48} priority className={styles.brandMark} />
          <span className={styles.brandWordmark}>
            <span className={styles.brandName}>{brand.name}</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {onResults ? (
            <Link className={styles.navLink} href="/results" aria-current="page">Matches</Link>
          ) : (
            <a className={styles.navLink} href="#recent-results">
              Matches
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 3.5v9m-3.5-3.5L8 12.5l3.5-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
