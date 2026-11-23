import "server-only";

export function playerPortraitsEnabled() {
  return process.env.FOOTBALL_PLAYER_IMAGES_ENABLED !== "false";
}

export function footballMediaPath(value: unknown, kind: "teams" | "leagues" | "players") {
  if (typeof value !== "string") return null;
  const parts = /^https:\/\/cdn\.pitchapi\.dev\/(images\/)?(teams|leagues|players)\/([a-zA-Z0-9_-]{1,100}\.webp)$/.exec(value);
  return parts?.[2] === kind ? `/media/football/${parts[1] ? "images" : "original"}/${kind}/${parts[3]}` : null;
}
