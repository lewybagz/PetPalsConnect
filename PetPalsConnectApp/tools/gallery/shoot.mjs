#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

/**
 * Photographs every board in `boards.js`, light and dark.
 *
 * Serves the static export from `npm run gallery` and drives a headless
 * Chromium over it. The device profile is an iPhone 14 Pro's logical size and
 * pixel ratio, so the images are the shape and density of the product rather
 * than of a desktop browser window.
 *
 *   npm run gallery && npm run screenshots
 *
 * This is a review tool, not a test: nothing here asserts. It exists because
 * the design system is the one part of the app that cannot be checked by
 * reading, and this container has no Android SDK, no KVM and no macOS.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DIST = path.join(ROOT, "dist-gallery");
const OUT = path.join(ROOT, "screenshots");
const PORT = 8099;

/** A phone, not a browser window. */
const DEVICE = { width: 390, height: 844, deviceScaleFactor: 2 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const serve = () =>
  new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://localhost");
      const asset = path.join(DIST, decodeURIComponent(url.pathname));

      // Anything that is not a real file is the single-page entry, which is how
      // `?board=&theme=` reaches the app.
      const file =
        fs.existsSync(asset) && fs.statSync(asset).isFile()
          ? asset
          : path.join(DIST, "index.html");

      response.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      });
      fs.createReadStream(file).pipe(response);
    });

    server.listen(PORT, () => resolve(server));
  });

/** The board list, read from the same module the gallery renders from. */
const boards = () => {
  const source = fs.readFileSync(path.join(HERE, "boards.js"), "utf8");
  return [...source.matchAll(/^\s{4}id: "([\w-]+)",\n\s{4}label: "([^"]+)"/gm)].map(
    ([, id, label]) => ({ id, label })
  );
};

const main = async () => {
  if (!fs.existsSync(DIST)) {
    console.error("No dist-gallery/. Run `npm run gallery` first.");
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const server = await serve();
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });

  const failures = [];
  const shot = async (board, theme) => {
    const context = await browser.newContext({
      viewport: { width: DEVICE.width, height: DEVICE.height },
      deviceScaleFactor: DEVICE.deviceScaleFactor,
      colorScheme: theme,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    // A screen that throws renders blank, and a blank PNG looks like a design
    // decision unless somebody is listening for this.
    page.on("pageerror", (error) =>
      failures.push(`${board.id}/${theme}: ${error.message}`)
    );

    await page.goto(
      `http://localhost:${PORT}/?board=${board.id}&theme=${theme}`,
      { waitUntil: "networkidle" }
    );
    await page.waitForSelector('[data-testid="board"]', { timeout: 15000 });
    // Let the fonts settle and the skeleton pulse reach a stable frame.
    await page.waitForTimeout(600);

    const file = path.join(OUT, `${board.id}-${theme}.png`);
    await page.screenshot({ path: file });
    await context.close();

    return file;
  };

  const taken = [];
  for (const board of boards()) {
    for (const theme of ["light", "dark"]) {
      try {
        taken.push(await shot(board, theme));
        process.stdout.write(`  ${board.id} (${theme})\n`);
      } catch (error) {
        failures.push(`${board.id}/${theme}: ${error.message}`);
      }
    }
  }

  await browser.close();
  server.close();

  console.log(`\n${taken.length} screenshots in ${path.relative(ROOT, OUT)}/`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s):`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
