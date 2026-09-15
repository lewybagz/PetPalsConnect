import { copyFileSync, mkdirSync, existsSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Brings the gallery screenshots the site shows into `public/screens/`.
 *
 * A file copy, deliberately, and not an import: the marketing site never
 * imports from `PetPalsConnectApp/` or `backend/`, the same hard rule the app
 * and the backend already hold to each other. Reading bytes off disk at build
 * time is not a module edge.
 *
 * The list is explicit and names exactly what a page renders, so a renamed
 * or deleted board fails the build. A landing page showing a screen the app
 * no longer has is the same class of lie as a stale legal document, and it
 * is the failure nobody would notice: the picture still loads, it is just
 * not the product any more.
 *
 * Each one is copied as the PNG the gallery wrote and also encoded as a WebP
 * at the width the clay phone frame actually renders it, which is the one a
 * browser will pick. The PNG stays as the fallback.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const GALLERY = resolve(HERE, "../../PetPalsConnectApp/screenshots");
const OUT = resolve(HERE, "../public/screens");

/** The phone frame is at most 280 CSS px wide; this is that at 2x. */
const WEBP_WIDTH = 600;

/** Board and theme, and where on the site it appears. */
const SCREENS = [
  { board: "discover", theme: "light", where: "the deck, on the playdates section" },
  { board: "discover-swipe", theme: "dark", where: "the second phone beside it, mid-throw" },
  { board: "care-hub", theme: "light", where: "the care hub, on the care section" },
  { board: "toxin-lookup", theme: "light", where: "the poison lookup, on /care" },
];

/** PNG dimensions from the header, so the manifest carries them for CLS. */
const pngSize = (file) => {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

const missing = [];
const manifest = {};
let reused = 0;

// Only what this script writes is removed - never the folder. `art.mjs` next
// door wiped its output folder on every run and deleted illustrations that
// had been put there by hand; the same shape here would do the same thing.
mkdirSync(OUT, { recursive: true });
const MANIFEST = join(OUT, "manifest.json");
const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const wanted = new Set(SCREENS.map(({ board, theme }) => `${board}-${theme}`));
for (const f of readdirSync(OUT)) {
  const m = f.match(/^([\w-]+-(?:light|dark))\.(png|webp)$/);
  if (m && !wanted.has(m[1])) rmSync(join(OUT, f));
}

for (const { board, theme } of SCREENS) {
  const key = `${board}-${theme}`;
  const from = join(GALLERY, `${key}.png`);

  if (!existsSync(from)) {
    missing.push(`${key}.png`);
    continue;
  }

  // Incremental, like art.mjs: a board the gallery has not re-rendered since
  // the last run, whose copies are still there, is left alone.
  const stat = statSync(from);
  const before = previous[key];
  if (
    before?.sourceMtime === stat.mtimeMs &&
    before?.sourceSize === stat.size &&
    existsSync(join(OUT, `${key}.png`)) &&
    existsSync(join(OUT, `${key}.webp`))
  ) {
    manifest[key] = before;
    reused += 1;
    continue;
  }

  copyFileSync(from, join(OUT, `${key}.png`));
  await sharp(from).resize({ width: WEBP_WIDTH }).webp({ quality: 82 }).toFile(join(OUT, `${key}.webp`));
  manifest[key] = { ...pngSize(from), sourceMtime: stat.mtimeMs, sourceSize: stat.size };
}

if (missing.length > 0) {
  console.error(
    `\n[screens] ${missing.length} screenshot(s) named by the site do not exist:\n` +
      missing.map((name) => `[screens]   ${name}`).join("\n") +
      `\n\n[screens] Either the board was renamed - update SCREENS in this file -\n` +
      `[screens] or the gallery has not been run. From PetPalsConnectApp/:\n` +
      `[screens]   npm run gallery && npm run screenshots\n`
  );
  process.exit(1);
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[screens] ${SCREENS.length} screenshots: ${SCREENS.length - reused} copied and encoded, ${reused} unchanged.`);
