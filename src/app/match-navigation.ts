export function matchHref(id: string, source: "home" | "results", date?: string) {
  const query = new URLSearchParams({ from: source });
  if (date) query.set("date", date);
  return `/matches/${encodeURIComponent(id)}?${query}`;
}
