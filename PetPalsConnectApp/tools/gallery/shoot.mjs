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

/**
 * The board list, read from the same module the gallery renders from.
 *
 * Parsed rather than imported, because `boards.js` is JSX that only Metro can
 * load - so this file reads the two or three fields it needs out of the source
 * text. That cost a real hour: `scrollY` was added to a board, this parser kept
 * only `id` and `label`, and every scrolled screenshot came out silently
 * unscrolled with nothing anywhere saying why. Any new per-board option has to
 * be picked up here as well as declared there.
 */
const boards = () => {
  const source = fs.readFileSync(path.join(HERE, "boards.js"), "utf8");
  const matches = [
    ...source.matchAll(/^\s{4}id: "([\w-]+)",\n\s{4}label: "([^"]+)"/gm),
  ];

  return matches.map((match, index) => {
    // Everything between this board's `id:` and the next one's - the only
    // reliable way to attribute an option to the board that declared it.
    const start = match.index;
    const end = matches[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    const scrollY = block.match(/^\s{4}scrollY: (\d+),/m)?.[1];

    return {
      id: match[1],
      label: match[2],
      ...(scrollY ? { scrollY: Number(scrollY) } : {}),
    };
  });
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

    /**
     * Scrolled down first, when a board asks to be.
     *
     * A phone viewport is the honest frame for most screens, and for those the
     * fold is exactly the thing worth reviewing. But the care hub is four
     * stacked sections and everything below the second was simply never
     * photographed - half of a screen this tool exists to make reviewable.
     *
     * Playwright's own `fullPage` cannot help: react-native-web renders a
     * ScrollView as a fixed-height element with its own overflow, so the
     * document is always exactly one viewport tall no matter how much content
     * is inside it. The scrolling has to happen in the element, which is what
     * this does - the deepest scrollable node, since `Screen` wraps its
     * content in one.
     */
    if (board.scrollY) {
      const scrolled = await page.evaluate((offset) => {
        // Every scrollable node, not a guess at which one: the board is nested
        // several levels deep and which element carries the overflow depends
        // on whether the screen used `Screen scroll` or its own ScrollView.
        // Scrolling all of them is harmless - the ones already at the bottom
        // clamp - and it is the only version of this that is not brittle.
        const nodes = [...document.querySelectorAll("*")].filter(
          (node) => node.scrollHeight > node.clientHeight + 40
        );
        for (const node of nodes) node.scrollTop = offset;
        return nodes.length;
      }, board.scrollY);

      if (scrolled === 0) {
        failures.push(
          `${board.id}/${theme}: asked to scroll to ${board.scrollY} but nothing ` +
            `on the page scrolls - the screenshot is the top of the screen`
        );
      }
      // The scroll is instant, but a re-render triggered by it is not.
      await page.waitForTimeout(300);
    }

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
