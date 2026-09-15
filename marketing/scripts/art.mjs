import { mkdirSync, existsSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Turns the illustrations in `art/` into what the pages actually load.
 *
 * The pieces arrive as 2048px PNGs, which is the right thing to keep and the
 * wrong thing to serve: one of them is a multi-megabyte hero on a page that
 * has to paint in under two and a half seconds on a phone. Each source
 * becomes AVIF and WebP at four widths plus one fallback, and
 * `public/art/manifest.json` tells the build which widths exist and how big
 * the fallback is, so every `<img>` ships with dimensions and nothing shifts.
 *
 * Incremental. `npm run dev` and `npm run build` both run this, and the
 * first version re-encoded every piece on every run - sixty sharp jobs to
 * start a dev server whose pictures had not changed. Each manifest entry
 * records the source's mtime and size; a source that matches its entry and
 * whose outputs are all present is skipped. Touch a source, or delete an
 * output, and only that piece is redone.
 *
 * A piece that is not there yet is reported, not fatal. The art is supplied
 * by hand, the page renders a labelled slot in its place, and a build that
 * refused to run until all seven arrived would block everything else on the
 * one thing this repo cannot generate.
 *
 * The Open Graph image is made here too: the install piece, cropped to
 * 1200x630, because it was composed with cream space on one side for exactly
 * this. Until it arrives, a plain cream card with the mark - never text
 * rendered here, since the fonts on the machine doing the build are not
 * the fonts the site uses.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../art");
const OUT = resolve(HERE, "../public/art");
const MANIFEST = join(OUT, "manifest.json");
const OG = resolve(HERE, "../public/og.png");

const WIDTHS = [480, 800, 1200, 1600];

/** The seven pieces the pages reference, so a missing one is named. */
const EXPECTED = ["hero", "dog", "park", "care", "arizona", "safety", "install"];

/** What this script writes, and therefore the only thing it may remove. */
const GENERATED = /^[\w-]+-\d+\.(avif|webp|jpg|png)$/;
const IMAGE = /\.(png|jpe?g|webp)$/i;

mkdirSync(OUT, { recursive: true });

// Sources put in the output folder by mistake. Easy to do: `public/art/` is
// the URL the pictures are served from, so it is the obvious place to put
// them. The first version of this script wiped the folder on every run and
// deleted somebody's illustrations. Nothing here removes a file it did not
// write; a misplaced source is named and the run stops.
const misplaced = readdirSync(OUT).filter((f) => IMAGE.test(f) && !GENERATED.test(f));
if (misplaced.length > 0) {
  console.error(
    `\n[art] ${misplaced.length} file(s) in public/art/ look like sources, not build output:\n` +
      misplaced.map((f) => `[art]   ${f}`).join("\n") +
      `\n\n[art] public/art/ is generated. Move them to marketing/art/ and run this again.\n`
  );
  process.exit(1);
}

const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const sources = existsSync(SRC) ? readdirSync(SRC).filter((f) => IMAGE.test(f)) : [];

/** Every file an entry says it made. */
const outputsOf = (name, entry) => [
  ...entry.widths.flatMap((w) => [`${name}-${w}.avif`, `${name}-${w}.webp`]),
  entry.fallback,
];

const manifest = {};
let encoded = 0;
let reused = 0;

for (const file of sources) {
  const name = basename(file, extname(file)).toLowerCase();
  if (!/^[\w-]+$/.test(name)) {
    console.error(`[art] "${file}" has a name the page cannot reference. Use letters, digits, - or _.`);
    process.exit(1);
  }

  const source = join(SRC, file);
  const stat = statSync(source);
  const fingerprint = { sourceMtime: stat.mtimeMs, sourceSize: stat.size };

  const before = previous[name];
  const unchanged =
    before &&
    before.sourceMtime === fingerprint.sourceMtime &&
    before.sourceSize === fingerprint.sourceSize &&
    outputsOf(name, before).every((f) => existsSync(join(OUT, f)));

  if (unchanged) {
    manifest[name] = before;
    reused += 1;
    continue;
  }

  // Redoing this piece: clear what an earlier run made for it, since a
  // resized source can change which widths exist.
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`${name}-`) && GENERATED.test(f)) rmSync(join(OUT, f));
  }

  const meta = await sharp(source).metadata();

  // Never upscale: every width is at most the source's own.
  const widths = [...new Set([...WIDTHS.filter((w) => w < meta.width), Math.min(meta.width, 1600)])].sort(
    (a, b) => a - b
  );

  for (const width of widths) {
    await sharp(source).resize({ width }).avif({ quality: 55 }).toFile(join(OUT, `${name}-${width}.avif`));
    await sharp(source).resize({ width }).webp({ quality: 80 }).toFile(join(OUT, `${name}-${width}.webp`));
  }

  // The fallback keeps transparency where the piece has it (the isolated
  // subjects) and goes to JPEG where it does not (the cream-ground scenes).
  const largest = widths[widths.length - 1];
  const fallback = `${name}-${largest}.${meta.hasAlpha ? "png" : "jpg"}`;
  const pipeline = sharp(source).resize({ width: largest });
  await (meta.hasAlpha ? pipeline.png() : pipeline.jpeg({ quality: 82, mozjpeg: true })).toFile(
    join(OUT, fallback)
  );
  const fb = await sharp(join(OUT, fallback)).metadata();

  manifest[name] = { width: fb.width, height: fb.height, widths, fallback, ...fingerprint };
  encoded += 1;
}

// Outputs for a source that no longer exists.
for (const f of readdirSync(OUT)) {
  const m = f.match(/^([\w-]+)-\d+\.(avif|webp|jpg|png)$/);
  if (m && !manifest[m[1]]) rmSync(join(OUT, f));
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

// ---------------------------------------------------------------------------
// Open Graph. Remade only when the install piece changed or og.png is gone.
// ---------------------------------------------------------------------------

const install = sources.find((f) => basename(f, extname(f)).toLowerCase() === "install");
const ogStale =
  !existsSync(OG) ||
  (install
    ? previous.install?.sourceMtime !== manifest.install?.sourceMtime
    : previous.install !== undefined);

if (ogStale) {
  if (install) {
    await sharp(join(SRC, install))
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .flatten({ background: "#f5efe3" })
      .png()
      .toFile(OG);
  } else {
    const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#f5efe3"/>
      <g transform="translate(520 235) scale(5)">
        <path d="M16 2 4 9v14l12 7 12-7V9z" fill="#c4703f"/>
        <path d="M16 2 4 9l12 7 12-7z" fill="#d98d5f"/>
        <path d="M16 16v14l12-7V9z" fill="#9d4f27"/>
        <circle cx="16" cy="14" r="3.1" fill="#f5efe3"/>
      </g>
    </svg>`;
    await sharp(Buffer.from(card)).png().toFile(OG);
  }
}

const have = Object.keys(manifest);
const missing = EXPECTED.filter((name) => !have.includes(name));

console.log(
  `[art] ${have.length} illustration(s): ${encoded} encoded, ${reused} unchanged; og.png ${
    ogStale ? (install ? "from install" : "is the placeholder card") : "unchanged"
  }.`
);
if (missing.length > 0) {
  console.log(`[art] Not yet supplied, rendering as slots: ${missing.join(", ")}.`);
  console.log(`[art] Drop them in marketing/art/ as <name>.png - see .claude/plans/marketing-site-art-prompts.md.`);
}
