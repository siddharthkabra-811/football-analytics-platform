"use client";

import { useId, useState, type ReactNode } from "react";
import { ClubCrest } from "../../club-crest";
import type { LineupProfile } from "./overview-data";
import styles from "./overview.module.css";

export function FormationPlayer({ name, club, number, captain, profile, history, side, left, top, children }: {
  name: string; club: string; number: string | null; captain: boolean; profile?: LineupProfile;
  history: string[]; side: "home" | "away"; left: number; top: number; children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <div className={styles.formationPlayer} data-side={side} data-open={open} data-upper={top < 52}
    style={{ left: `${left}%`, top: `${top}%` }} onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) setOpen(false); }}>
    <button type="button" className={styles.playerTrigger} aria-label={`View ${name} profile`} aria-expanded={open}
      aria-controls={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      {children}
    </button>
    {open && <div className={styles.profileCard} id={id}>
      <div className={styles.profileHeader}>
        <ClubCrest name={name} src={profile?.image ?? null} className={styles.playerPortrait} />
        <div><strong>{name}</strong><p>{club}{number && ` · #${number}`}{captain && " · Captain"}</p></div>
      </div>
      {(profile?.rating != null || profile?.minutes != null) && <p className={styles.profileStats}>
        {profile.rating != null && <span><strong>{profile.rating.toFixed(1)}</strong> rating</span>}
        {profile.minutes != null && <span><strong>{profile.minutes}′</strong> played</span>}
      </p>}
      {history.length > 0 && <ul>{history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>}
    </div>}
  </div>;
}
