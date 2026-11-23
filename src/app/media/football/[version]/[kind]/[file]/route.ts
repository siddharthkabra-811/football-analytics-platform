export async function GET(_request: Request, { params }: {
  params: Promise<{ version: string; kind: string; file: string }>;
}) {
  const { version, kind, file } = await params;
  const enabled = kind === "players"
    ? process.env.NODE_ENV === "development" || process.env.FOOTBALL_PLAYER_IMAGES_ENABLED === "true"
    : process.env.PITCH_API_CRESTS_ENABLED === "true";
  if (!enabled || !["images", "original"].includes(version) || !["teams", "leagues", "players"].includes(kind)
    || !/^[a-zA-Z0-9_-]{1,100}\.webp$/.test(file)) return new Response(null, { status: 404 });

  try {
    const prefix = version === "images" ? "images/" : "";
    const asset = await fetch(`https://cdn.pitchapi.dev/${prefix}${kind}/${file}`, {
      signal: AbortSignal.timeout(4000), redirect: "error", next: { revalidate: 86400 },
    });
    if (!asset.ok || asset.headers.get("content-type")?.split(";")[0] !== "image/webp") {
      return new Response(null, { status: asset.status === 404 ? 404 : 502 });
    }
    return new Response(asset.body, { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
