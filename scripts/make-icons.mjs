// Renders the PNG app icons and the social share image from the SVG sources (uses the preinstalled Playwright).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // preinstalled; set NODE_PATH=$(npm root -g) if not local
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");
const icon = await readFile(path.join(dir, "icon.svg"), "utf8");
const mask = await readFile(path.join(dir, "maskable.svg"), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(svg, size, file, bg = "transparent") {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(dir, file), omitBackground: bg === "transparent" });
}
await shot(icon, 192, "icon-192.png");
await shot(icon, 512, "icon-512.png");
await shot(mask, 512, "maskable-512.png");
await shot(mask, 180, "apple-touch-icon.png");
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#F4F6F3;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;font-family:Georgia,serif;color:#1B2320">
  <div style="flex:none">${icon.replace("<svg ", '<svg width="260" height="260" ')}</div>
  <div><div style="font:600 30px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#9A7424">Seerah Lens</div>
  <div style="font-size:76px;line-height:1.08;margin:14px 0 22px">Read today.<br>See it lived.</div>
  <div style="font:400 30px system-ui,sans-serif;color:#5B6661">Daily Quran with the Seerah · No ads, ever</div></div></body></html>`);
await page.screenshot({ path: path.join(dir, "og.png") });
await browser.close();
console.log("icons written to", dir);
