export const matchViews = [
  { label: "Match", views: [["overview", "Overview"], ["timeline", "Match timeline"], ["stats", "Stats"], ["lineups", "Line-ups"], ["head-to-head", "Head-to-head"]] },
  { label: "Analysis", views: [["shots", "Shots"], ["xg", "xG"], ["momentum", "Momentum"], ["players", "Players"], ["passing", "Passing"], ["heatmaps", "Heatmaps"], ["advanced", "Advanced"], ["keepers", "Keepers"]] },
  { label: "Replay", views: [["theatre", "Theatre"]] },
] as const;

export type MatchView = typeof matchViews[number]["views"][number][0];

export function resolveMatchView(value: unknown, shot: unknown): MatchView {
  for (const group of matchViews) {
    for (const [view] of group.views) if (view === value) return view;
  }
  return typeof shot === "string" ? "shots" : "overview";
}
