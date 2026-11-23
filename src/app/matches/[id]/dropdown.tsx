"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./dropdown.module.css";

export function Dropdown({
  label, options, value, onChange, searchLabel, placeholder = "Select an option",
  emptyLabel = "No options available", compact = false, filter = false,
}: {
  label: string;
  options: { id: string; label: string; group?: string }[];
  value: string;
  onChange: (id: string) => void;
  searchLabel?: string;
  placeholder?: string;
  emptyLabel?: string;
  compact?: boolean;
  filter?: boolean;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = options.find((option) => option.id === value);
  const visible = open && options.length > 0;
  const matching = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!visible) return;
    const activeOption = list.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    (search.current ?? activeOption ?? list.current?.querySelector("button"))?.focus({ preventScroll: true });
    activeOption?.scrollIntoView({ block: "nearest", inline: "nearest" });

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [visible]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return <div ref={root} className={filter ? `${styles.dropdown} ${styles.filter}` : styles.dropdown}
    data-compact={compact || undefined}
    onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && visible) {
        event.stopPropagation();
        close();
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      if (!visible) {
        if (options.length) { setQuery(""); setOpen(true); }
        return;
      }
      const buttons = Array.from(list.current?.querySelectorAll("button") ?? []);
      const index = buttons.findIndex((button) => button === event.target);
      const next = event.key === "ArrowDown" ? buttons[index + 1] : buttons[index - 1];
      if (next) next.focus();
      else if (event.key === "ArrowUp") search.current?.focus();
    }}>
    {!compact && <span className={styles.pickerLabel}>{label}</span>}
    <button type="button" data-dropdown-button ref={trigger} disabled={!options.length} aria-expanded={visible}
      aria-controls={visible ? menuId : undefined}
      aria-label={`${label}: ${selected?.label ?? (options.length ? placeholder : emptyLabel)}`}
      onClick={() => { setQuery(""); setOpen(!visible); }}>
      <span>{selected?.label ?? (options.length ? placeholder : emptyLabel)}</span>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    {visible && <div id={menuId} className={styles.options}>
      {searchLabel && <input type="search" ref={search} value={query} onChange={(event) => setQuery(event.currentTarget.value)}
        aria-label={searchLabel} placeholder={searchLabel} />}
      <ul role="list" ref={list}>{matching.map(({ id, label, group }, index) => <li key={id}>
        {group && group !== matching[index - 1]?.group && <span className={styles.group}>{group}</span>}
        <button type="button" data-dropdown-button aria-pressed={id === value} onClick={() => { onChange(id); close(); }}>{label}</button>
      </li>)}</ul>
      {!matching.length && <p role="status">No matches found.</p>}
    </div>}
  </div>;
}
