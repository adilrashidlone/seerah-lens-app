# Seerah Lens

**Read today. See it lived.** A daily Quran reading app: read a short portion, then see a moment from the life of the Prophet ﷺ that shows it revealed, applied or lived. Every Seerah card quotes its sources word for word and gives a grade. A second daily track, *Understand Your Salah*, teaches the words you say in prayer.

It's an installable, offline-first web app (PWA). It has no ads and no trackers, and needs no account. All user data stays on the device.

## What's in this release (MVP)

| Area | Status |
|---|---|
| Reading plans | Juz ‘Amma (15 days), Al-Kahf (4 days, one per story), Yasin (2 days) |
| Quran text | Arabic (Uthmani), transliteration and English meaning for Al-Fatiha, Al-Kahf, Yasin and all of Juz 30 |
| Seerah Lens cards | 17 sourced cards for Juz ‘Amma and 1 for Al-Fatiha. Al-Kahf and Yasin cards show as **pending scholar review**, with no unverified content |
| Understand Your Salah | 9 lessons with flip cards, a quiz and a “% of my Salah I understand” score |
| Journal | Private reflections, plus review notes for the scholar panel (copy all) |
| Habit | Streak with one grace day per week, 7-day view, plan progress |
| Settings | Theme (light/dark/device), Arabic text size, language switch (English now; Hindi, Urdu and Telugu are wired in), backup/restore, reset |
| Offline | Service worker caches the app and every surah on first visit |
| Install | Android/desktop install prompt, plus iPhone “Add to Home Screen” guidance |
| SEO | One crawlable page per surah (`/surah/al-kahf/`, `/surah/yasin/` …), a surah index, canonical tags, Open Graph, `WebApplication`, `WebPage` and `BreadcrumbList` schema, `sitemap.xml`, `robots.txt` |

## Run it

```bash
npm install
npm run build        # builds dist/
npm run serve        # http://localhost:8080
npm test             # end-to-end browser check (Playwright)
```

Other scripts:
- `npm run fetch-quran` rebuilds `data/quran/` when the surah list changes.
- `npm run icons` re-renders the PNG icons and the social image from the SVGs in `public/icons/`.

## Project layout

```
src/index.html      app shell (meta tags, schema placeholders)
src/app.js          the app: views, router, state (localStorage), i18n strings
src/app.css         design tokens and components (light + dark)
src/sw.js           service worker template (asset list injected at build)
data/content.json   plans, Seerah cards, Salah lessons  ← editorial content lives here
data/quran/*.json   surah text: [ayah, arabic, transliteration, english]
public/icons/       app icons and social share image
scripts/            build, fetch, icons, local server, smoke test
```

### Adding a Seerah card
Edit `data/content.json`. To publish a pending card, remove `"pending": true` and add `type`, `x` (excerpts: `arabic`, `ref`, `grade`, `url`), `summary`, `you` and `reflect`. Copy the shape of any Juz ‘Amma card. Only publish a card after the scholar panel has approved it.

### Adding a language
Add a block to `STR` in `src/app.js` with the same keys as `en`. The language button activates on its own. Quran meanings in Hindi, Urdu and Telugu need a licensed translation before they're added.

## Deploy
Pushing to `main` builds the site and publishes it to the `gh-pages` branch through `.github/workflows/deploy.yml`. GitHub Pages serves that branch at https://adilrashidlone.github.io/seerah-lens-app/. When a custom domain is ready, set the repository variable `SITE_URL` so canonical tags and the sitemap point to it.

**Play Store:** the same PWA can be wrapped as an Android app with a Trusted Web Activity (Bubblewrap / PWABuilder) once it's on its final domain.

## Content sources and rights
- Arabic text: QuranEnc (Uthmani), via the `quran-json` dataset. Openly licensed, with attribution.
- Transliteration: Tanzil.net. Free with attribution.
- English meaning: Marmaduke Pickthall (1930). Public domain.
- Hadith and tafsir excerpts: the classical Arabic texts (public domain). English translations of excerpts are pending licences.

## Not built yet (next steps)
- Word-by-word meaning on tap for every verse (needs a licensed word-by-word dataset)
- Seerah cards for Al-Kahf and Yasin (scholar panel)
- Hindi, Urdu and Telugu interface and Quran meanings (licensed translations)
- Audio: recitation and narrated cards
- Daily reminder notifications
