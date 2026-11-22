"use client";

import { useEffect } from "react";

export function ResultsMotion({ date }: { date: string }) {
  useEffect(() => {
    const section = document.getElementById("recent-results");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!section || preference.matches || !("IntersectionObserver" in window)) return;

    const counts = new Map<HTMLElement, { frame: number; home: number; away: number }>();

    function countToScore(card: HTMLElement, delay: number) {
      const home = card.querySelector<HTMLElement>("[data-score-home]");
      const away = card.querySelector<HTMLElement>("[data-score-away]");
      if (!home || !away) return;

      const finalHome = Number(home.dataset.scoreHome);
      const finalAway = Number(away.dataset.scoreAway);
      if (finalHome === 0 && finalAway === 0) return;

      const start = performance.now() + delay;
      const count = { frame: 0, home: finalHome, away: finalAway };
      home.textContent = "0";
      away.textContent = "0";
      const step = (now: number) => {
        if (now >= start) {
          const progress = Math.min((now - start) / 360, 1);
          const eased = 1 - (1 - progress) ** 2;
          home.textContent = String(Math.round(finalHome * eased));
          away.textContent = String(Math.round(finalAway * eased));
          if (progress === 1) {
            counts.delete(card);
            return;
          }
        }
        count.frame = requestAnimationFrame(step);
      };
      count.frame = requestAnimationFrame(step);
      counts.set(card, count);
    }

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top
          || left.boundingClientRect.left - right.boundingClientRect.left);

      visible.forEach(({ target }, index) => {
        if (!(target instanceof HTMLElement)) return;
        const delay = Math.min(index * 75, 225);
        target.style.setProperty("--entrance-delay", `${delay}ms`);
        target.dataset.entered = "true";
        observer.unobserve(target);
        if (target.hasAttribute("data-result-card")) countToScore(target, delay);
      });
    }, { threshold: .28 });

    section.querySelectorAll("[data-results-heading], [data-result-card]").forEach((target) => {
      if (!target.hasAttribute("data-entered")) observer.observe(target);
    });

    function stop() {
      observer.disconnect();
      for (const [card, count] of counts) {
        cancelAnimationFrame(count.frame);
        const home = card.querySelector("[data-score-home]");
        const away = card.querySelector("[data-score-away]");
        if (home) home.textContent = String(count.home);
        if (away) away.textContent = String(count.away);
      }
      counts.clear();
    }

    preference.addEventListener("change", stop);
    return () => {
      preference.removeEventListener("change", stop);
      stop();
    };
  }, [date]);

  return null;
}
