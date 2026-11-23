import assert from "node:assert/strict";

const [base, matchPath] = process.argv.slice(2);
if (!base || !matchPath) throw new Error("Provide the site URL and a known match path.");

const agents = [
  "Mozilla/5.0",
  "Twitterbot/1.0",
  "facebookexternalhit/1.1",
  "WhatsApp/2.24",
  "Slackbot-LinkExpanding 1.0",
  "LinkedInBot/1.0",
  "Discordbot/2.0",
];

for (const path of ["/", "/results", matchPath]) {
  await Promise.all(agents.map(async (agent) => {
    const context = `${path} (${agent})`;
    const options = { headers: { "User-Agent": agent }, signal: AbortSignal.timeout(15000) };
    const page = await fetch(new URL(path, base), options);
    assert.equal(page.status, 200, context);

    const head = (await page.text()).split("</head>")[0];
    const image = head.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    assert.ok(image, `Missing Open Graph image in the head for ${context}`);
    assert.match(image, /^https:\/\//, context);
    assert.ok(head.includes('<meta name="twitter:card" content="summary_large_image"'), context);
    assert.ok(head.includes(`<meta name="twitter:image" content="${image}"`), context);
    assert.ok(head.includes('<meta property="og:image:type" content="image/jpeg"'), context);

    // Fetch the same asset from the candidate deployment when testing locally.
    const preview = await fetch(new URL(new URL(image).pathname, base), options);
    assert.equal(preview.status, 200, context);
    assert.match(preview.headers.get("content-type") ?? "", /^image\/jpeg\b/, context);
    const bytes = new Uint8Array(await preview.arrayBuffer());
    assert.ok(bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, context);
  }));
  console.log(`${path}: checked metadata and image with ${agents.length} crawler user agents.`);
}
