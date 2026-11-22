"use client";

import Image from "next/image";
import styles from "./club-crest.module.css";

export function ClubCrest({ name, src, className }: {
  name: string;
  src: string | null;
  className: string;
}) {
  const words = name.split(/\s+/);
  const initials = words.length === 1 ? name.slice(0, 3) : words.slice(0, 3).map((word) => word[0]).join("");

  return (
    <span className={`${styles.crest} ${className}`} aria-hidden="true">
      <span className={styles.fallback}>{initials.toUpperCase()}</span>
      {src && (
        <Image src={src} alt="" width={28} height={28} unoptimized
          onError={(event) => { event.currentTarget.hidden = true; }} />
      )}
    </span>
  );
}
