// Builds data/quran/<n>.json for every surah the app ships.
// Arabic (Uthmani, QuranEnc) + transliteration (Tanzil) come from the quran-json npm package.
// English meaning is Marmaduke Pickthall (1930, public domain), from the fawazahmed0/quran-api mirror.
// Run: npm run fetch-quran   (only needed when the surah list changes; output is committed)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("quran-json/package.json"));
const PICKTHALL = (n) => `https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/eng-mohammedmarmadu/${n}.json`;

const content = JSON.parse(await readFile(path.join(root, "data/content.json"), "utf8"));
const wanted = new Set();
for (const plan of content.plans) for (const day of plan.days) for (const seg of day) wanted.add(seg.s);
wanted.add(1); // Al-Fatiha is always needed for Salah

await mkdir(path.join(root, "data/quran"), { recursive: true });
const index = [];
for (const n of [...wanted].sort((a, b) => a - b)) {
  const ch = JSON.parse(await readFile(path.join(pkgDir, "dist/chapters", `${n}.json`), "utf8"));
  const enMeta = JSON.parse(await readFile(path.join(pkgDir, "dist/chapters/en", `${n}.json`), "utf8"));
  const res = await fetch(PICKTHALL(n));
  if (!res.ok) throw new Error(`Pickthall ${n}: HTTP ${res.status}`);
  const en = (await res.json()).chapter;
  if (en.length !== ch.verses.length) throw new Error(`Verse count mismatch in surah ${n}`);
  const surah = {
    n,
    ar: ch.name,
    tr: ch.transliteration,
    en: enMeta.translation,
    type: ch.type,
    verses: ch.verses.map((v, i) => [v.id, v.text, v.transliteration, en[i].text.trim()]),
  };
  await writeFile(path.join(root, "data/quran", `${n}.json`), JSON.stringify(surah));
  index.push({ n, ar: surah.ar, tr: surah.tr, en: surah.en, type: surah.type, count: surah.verses.length });
  console.log(`surah ${n} ${surah.tr}: ${surah.verses.length} verses`);
}
await writeFile(path.join(root, "data/surahs.json"), JSON.stringify(index, null, 1));
