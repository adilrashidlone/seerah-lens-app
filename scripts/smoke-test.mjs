// End-to-end check in a real browser: onboarding, reading, Seerah Lens, journal, Salah quiz, settings,
// offline reload through the service worker, and an SEO surah page. Run after `npm run build`.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium, devices } = createRequire(import.meta.url)("playwright");
const { server } = await import("./serve.mjs");
const shots = process.env.SHOTS || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test-shots");
await mkdir(shots, { recursive: true });

const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// Network failures are judged per request (fonts are expected to fail while offline); other console errors count.
page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
page.on("requestfailed", (r) => { if (r.url().startsWith(base)) errors.push("Failed: " + r.url()); });
let step = 0;
const check = (ok, msg) => { step++; console.log(`${ok ? "PASS" : "FAIL"} ${step}. ${msg}`); if (!ok) process.exitCode = 1; };
const snap = (name) => page.screenshot({ path: path.join(shots, name + ".png"), fullPage: false });

await page.goto(base);
await page.waitForSelector("#beginBtn");
check(true, "Welcome screen shows on first visit"); await snap("01-welcome");
await page.click("#beginBtn");
await page.waitForSelector("text=Day 1 of 15");
check(await page.isVisible(".tabs"), "Today view after onboarding, tabs visible"); await snap("02-today");

await page.click("text=Start today’s reading");
await page.waitForSelector(".verse");
check((await page.locator(".verse").count()) === 40 + 46, "Day 1 shows An-Naba (40) + An-Nazi'at (46) ayat"); await snap("03-read");
await page.click("#finishBtn");
await page.waitForSelector(".lens");
check(await page.isVisible("text=Sent with the Hour"), "Finishing opens the Seerah Lens card"); await snap("04-lens");
await page.fill("textarea[id^=reflect-]", "Test reflection");
await page.click("[data-save]");
await page.click(".tabs >> text=Journal");
check(await page.isVisible("text=Test reflection"), "Reflection saved to journal");

await page.goto(base + "#plan/kahf"); await page.waitForSelector("[data-useplan]");
await page.click("[data-useplan]"); await page.waitForSelector("text=Day 1 of 4");
await page.click("text=Start today’s reading"); await page.waitForSelector(".verse");
check((await page.locator(".verse").count()) === 26, "Al-Kahf day 1 shows ayat 1–26");
await page.click("#finishBtn"); await page.waitForSelector(".lens.pending");
check(await page.isVisible("text=Pending scholar review"), "Al-Kahf card shows as pending review, no unverified content"); await snap("05-kahf-pending");

await page.goto(base + "#lesson/f1"); await page.click("[data-quiz]");
for (let i = 0; i < 8; i++) { await page.waitForSelector(".opt:not([disabled])"); await page.locator(".opt").first().click(); await page.waitForTimeout(1500); }
await page.waitForSelector("text=correct");
check(true, "Salah lesson quiz completes"); await snap("06-quiz-done");

await page.goto(base + "#settings"); await page.click('[data-theme-set="dark"]'); await page.click('[data-qscale="1.2"]');
check((await page.getAttribute("html", "data-theme")) === "dark", "Dark theme applies"); await snap("07-settings-dark");

await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
await ctx.setOffline(true);
await page.goto(base + "#read/yasin/2"); await page.waitForSelector(".verse", { timeout: 10000 });
check((await page.locator(".verse").count()) === 43, "Offline: Yasin 41–83 loads from the service worker cache");
await ctx.setOffline(false);

await page.goto(base + "surah/al-kahf/");
check((await page.title()).startsWith("Surah Al-Kahf (18)"), "SEO page title for Al-Kahf");
check((await page.locator(".verse").count()) === 110, "SEO page has all 110 ayat");
const ld = await page.locator('script[type="application/ld+json"]').textContent();
check(ld.includes("BreadcrumbList"), "SEO page has breadcrumb schema"); await snap("08-seo-kahf");

check(errors.length === 0, "No JavaScript errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
