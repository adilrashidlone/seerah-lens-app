// Builds the deployable site into dist/:
//   index.html (the app), app.js/css, data/, icons, manifest, service worker,
//   plus one crawlable SEO page per surah at surah/<slug>/, a surah index, sitemap.xml and robots.txt.
// SITE_URL sets canonical links (default: the GitHub Pages address). Set it when a custom domain is live.
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist");
let SITE_URL = process.env.SITE_URL || "https://adilrashidlone.github.io/seerah-lens-app/";
if (!SITE_URL.endsWith("/")) SITE_URL += "/";

const read = (p) => readFile(path.join(root, p), "utf8");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// URL slugs follow the spellings people search for; everything else derives from the transliteration.
const SLUG_OVERRIDES = { 1: "al-fatiha", 36: "yasin", 93: "ad-duha", 94: "ash-sharh", 107: "al-maun" };
const slugOf = (m) => SLUG_OVERRIDES[m.n] || slug(m.tr);
const slug = (tr) => tr.toLowerCase().replace(/[‘’'`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const content = JSON.parse(await read("data/content.json"));
const surahs = JSON.parse(await read("data/surahs.json"));
const quranFiles = (await readdir(path.join(root, "data/quran"))).filter((f) => f.endsWith(".json"));

// Version = hash of every input, so the service worker refreshes caches only when something changed.
const h = createHash("sha256");
for (const f of ["src/index.html", "src/app.js", "src/app.css", "src/sw.js", "data/content.json", "data/surahs.json"]) h.update(await read(f));
for (const f of quranFiles) h.update(await read("data/quran/" + f));
const VERSION = h.digest("hex").slice(0, 10);

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "data/quran"), { recursive: true });
await cp(path.join(root, "public"), out, { recursive: true });
await cp(path.join(root, "src/app.css"), path.join(out, "app.css"));
await cp(path.join(root, "src/app.js"), path.join(out, "app.js"));
await cp(path.join(root, "data/content.json"), path.join(out, "data/content.json"));
await cp(path.join(root, "data/surahs.json"), path.join(out, "data/surahs.json"));
for (const f of quranFiles) await cp(path.join(root, "data/quran", f), path.join(out, "data/quran", f));

// Where each surah is read inside the app (first plan/day that contains it).
const where = {};
for (const p of content.plans) p.days.forEach((day, i) => day.forEach((seg) => { if (!where[seg.s]) where[seg.s] = { plan: p.id, day: i + 1 }; }));

// ---------------------------------------------------------------- app shell
const appLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Seerah Lens",
  url: SITE_URL,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Android, iOS, Windows, macOS",
  description: "Daily Quran reading paired with sourced moments from the Seerah of the Prophet ﷺ, plus lessons on the words of Salah. No ads, works offline.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  inLanguage: "en",
};
const noscript = '<ul>' + surahs.map((s) => `<li><a href="surah/${slugOf(s)}/">Surah ${esc(s.tr)} (${s.n})</a></li>`).join("") + "</ul>";
let index = await read("src/index.html");
index = index.replaceAll("{{SITE_URL}}", SITE_URL).replaceAll("{{VERSION}}", VERSION)
  .replace("{{APP_JSONLD}}", JSON.stringify(appLd)).replace("{{NOSCRIPT_LINKS}}", noscript);
await writeFile(path.join(out, "index.html"), index);

// ---------------------------------------------------------------- manifest
const manifest = {
  name: "Seerah Lens: Daily Quran & Seerah",
  short_name: "Seerah Lens",
  description: "Read the Quran daily and see each passage lived in the Seerah. No ads, ever.",
  id: "./",
  start_url: "./#today",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  background_color: "#F4F6F3",
  theme_color: "#2C4A80",
  lang: "en",
  categories: ["education", "lifestyle", "books"],
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" },
  ],
  shortcuts: [
    { name: "Today’s reading", url: "./#today" },
    { name: "Understand your Salah", url: "./#salah" },
  ],
};
await writeFile(path.join(out, "manifest.webmanifest"), JSON.stringify(manifest, null, 1));

// ---------------------------------------------------------------- service worker
const assets = ["./", "index.html", "app.css", "app.js", "manifest.webmanifest", "data/content.json", "data/surahs.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png",
  ...quranFiles.map((f) => "data/quran/" + f)];
const sw = (await read("src/sw.js")).replace("{{VERSION}}", VERSION).replace("{{ASSETS}}", JSON.stringify(assets));
await writeFile(path.join(out, "sw.js"), sw);

// ---------------------------------------------------------------- SEO surah pages
const ordered = [...surahs].sort((a, b) => a.n - b.n);
function shell({ title, desc, canonical, ld, body, depth }) {
  const up = "../".repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}icons/og.png">
<meta name="theme-color" content="#2C4A80">
<link rel="manifest" href="${up}manifest.webmanifest">
<link rel="icon" href="${up}icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${up}icons/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Noto+Naskh+Arabic:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=Instrument+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${up}app.css?v=${VERSION}">
<style>.crumbs{font-size:14px;color:var(--muted)}.crumbs a{color:var(--muted)}.pager{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.cta{display:grid;gap:10px;border:1px solid var(--gold);background:var(--gold-soft);border-radius:var(--r);padding:18px 20px}.app{padding-bottom:48px}.idx{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}</style>
</head>
<body>
<div class="app">
<header class="top"><a class="brand" href="${up}"><svg class="star" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14"/><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="2.4"/></g></svg><b>Seerah Lens</b></a><a class="btn primary" href="${up}#today">Open the app</a></header>
<main class="stack">${body}</main>
<footer class="small muted" style="margin-top:32px;border-top:1px solid var(--line);padding-top:16px">Arabic text: QuranEnc (Uthmani). Transliteration: Tanzil.net. English meaning: Marmaduke Pickthall (1930, public domain). Seerah Lens has no ads and no trackers.</footer>
</div>
</body>
</html>`;
}

const urls = [{ loc: SITE_URL, pri: "1.0" }, { loc: SITE_URL + "surah/", pri: "0.8" }];
for (let i = 0; i < ordered.length; i++) {
  const m = ordered[i];
  const s = JSON.parse(await read(`data/quran/${m.n}.json`));
  const sl = slugOf(s), canonical = `${SITE_URL}surah/${sl}/`;
  const kind = s.type === "meccan" ? "Makki" : "Madani";
  const title = `Surah ${s.tr} (${s.n}): Arabic, Transliteration & English Meaning`;
  const desc = `Read Surah ${s.tr} (${s.en}), surah ${s.n} of the Quran: all ${s.verses.length} ayat in Arabic with transliteration and English meaning. A ${kind} surah. Free, no ads.`;
  const w = where[s.n];
  const cards = content.cards.filter((c) => c.surah === s.n && !c.pending);
  const prev = ordered[i - 1], next = ordered[i + 1];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": canonical, url: canonical, name: title, description: desc, inLanguage: "en",
        about: { "@type": "CreativeWork", name: `Surah ${s.tr}`, alternateName: s.ar, isPartOf: { "@type": "Book", name: "The Quran" } } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Seerah Lens", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Surahs", item: SITE_URL + "surah/" },
        { "@type": "ListItem", position: 3, name: `Surah ${s.tr}`, item: canonical } ] },
    ],
  };
  let body = `<nav class="crumbs"><a href="../../">Seerah Lens</a> › <a href="../">Surahs</a> › ${esc(s.tr)}</nav>`;
  body += `<div class="stack-sm"><span class="eyebrow">Surah ${s.n} · ${kind} · ${s.verses.length} ayat</span><h1>Surah ${esc(s.tr)}: Arabic, Transliteration and English Meaning</h1>`;
  body += `<p class="lead" style="margin:0">Surah ${esc(s.tr)} (${esc(s.ar)}, “${esc(s.en)}”) is surah ${s.n} of the Quran, a ${kind} surah of ${s.verses.length} ayat. Read it below in Arabic with transliteration and the English meaning.</p></div>`;
  if (w) {
    body += `<section class="cta"><div class="eyebrow" style="color:var(--gold)">Read it daily with the Seerah</div><div>${cards.length ? `In Seerah Lens, Surah ${esc(s.tr)} comes with a sourced moment from the life of the Prophet ﷺ: <b>${esc(cards[0].title)}</b>.` : `Read Surah ${esc(s.tr)} as part of a daily plan in Seerah Lens, with your own reflection journal.`}</div><a class="btn gold" href="../../#read/${w.plan}/${w.day}">Read Surah ${esc(s.tr)} in the app</a></section>`;
  }
  body += `<div class="surahhead"><span class="ar" lang="ar" dir="rtl">سورة ${esc(s.ar)}</span><span><b>${s.n}. ${esc(s.tr)}</b> <span class="muted">· ${esc(s.en)}</span></span></div>`;
  if (s.n !== 1 && s.n !== 9) body += `<div class="basmala" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>`;
  for (const v of s.verses) {
    body += `<div class="verse" id="${v[0]}"><div class="ar" lang="ar" dir="rtl">${esc(v[1])}<span class="marker">${String(v[0]).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])}</span></div><div class="tl">${esc(v[2])}</div><div class="en"><b>${s.n}:${v[0]}</b>${esc(v[3])}</div></div>`;
  }
  body += `<nav class="pager">${prev ? `<a class="btn" href="../${slugOf(prev)}/">← ${esc(prev.tr)}</a>` : "<span></span>"}${next ? `<a class="btn" href="../${slugOf(next)}/">${esc(next.tr)} →</a>` : ""}</nav>`;
  await mkdir(path.join(out, "surah", sl), { recursive: true });
  await writeFile(path.join(out, "surah", sl, "index.html"), shell({ title, desc, canonical, ld, body, depth: 2 }));
  urls.push({ loc: canonical, pri: "0.7" });
}

// Surah index page
{
  const canonical = SITE_URL + "surah/";
  const title = "Read the Quran Online: Surahs in Arabic, Transliteration & English";
  const desc = "Read Al-Fatiha, Al-Kahf, Yasin and every surah of Juz ‘Amma in Arabic with transliteration and English meaning. Free, no ads.";
  let body = `<nav class="crumbs"><a href="../">Seerah Lens</a> › Surahs</nav><div class="stack-sm"><h1>Read the Quran: surahs with transliteration and English meaning</h1><p class="lead" style="margin:0">${esc(desc)}</p></div><div class="idx">`;
  for (const m of ordered) body += `<a class="lesson" href="${slugOf(m)}/"><div><b>${m.n}. ${esc(m.tr)}</b><span class="small muted">${esc(m.en)} · ${m.count} ayat</span></div><span class="ar" lang="ar" style="font-family:var(--font-quran);font-size:20px">${esc(m.ar)}</span></a>`;
  body += "</div>";
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: canonical, description: desc };
  await mkdir(path.join(out, "surah"), { recursive: true });
  await writeFile(path.join(out, "surah", "index.html"), shell({ title, desc, canonical, ld, body, depth: 1 }));
}

const today = new Date().toISOString().slice(0, 10);
await writeFile(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`);
await writeFile(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
await writeFile(path.join(out, ".nojekyll"), "");

console.log(`Built version ${VERSION}: app + ${ordered.length} surah pages -> dist/ (site ${SITE_URL})`);
