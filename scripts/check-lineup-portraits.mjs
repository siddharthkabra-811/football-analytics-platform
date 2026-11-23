const target = process.argv[2];
if (!target) throw new Error("Provide a Line-ups page URL for a match with known portraits.");

const page = new URL(target);
page.searchParams.set("view", "lineups");
const pageResponse = await fetch(page, { signal: AbortSignal.timeout(15000) });
if (!pageResponse.ok) throw new Error(`Line-ups page returned HTTP ${pageResponse.status}.`);

const html = await pageResponse.text();
const paths = [...new Set(html.match(/\/media\/football\/(?:images|original)\/players\/[\w-]+\.webp/g))];
if (!paths.length) throw new Error("Line-ups supplies no portrait URLs. Check the deployment setting and use a match with known photos.");

const images = await Promise.allSettled(paths.slice(0, 5).map(async (path) => {
  const response = await fetch(new URL(path, page), { signal: AbortSignal.timeout(10000) });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/webp") {
    throw new Error(`Portrait request returned HTTP ${response.status} or an unexpected content type.`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Portrait response did not contain a WebP image.");
  }
}));
const loaded = images.filter((image) => image.status === "fulfilled").length;
if (!loaded) throw new Error("None of the sampled player portraits could be loaded.");
console.log(`Loaded ${loaded} of ${images.length} sampled player portraits.`);
