/**
 * The two image placeholders the pages use, resolved against the manifests
 * the build scripts write.
 *
 *   <!--@art hero 4/3 "alt" eager sizes="…"-->   an illustration, or a slot for one
 *   <!--@screen discover light "alt"-->          a gallery screenshot in a phone
 *
 * Pure functions on strings and manifest objects, kept out of
 * `vite.config.ts` so `site.test.ts` can exercise them with no Vite in
 * the room.
 *
 * `@art` emits a `<picture>` with AVIF and WebP sources at every width
 * `scripts/art.mjs` made - or, for a piece that has not arrived yet, a
 * labelled `.art-slot` with the right aspect ratio, so the page lays out as
 * it will and the gap is obvious. `@screen` never falls back: a screenshot is
 * of the real app, and `scripts/screens.mjs` has already failed the build if
 * one is missing, so an unknown key here is a typo in the HTML.
 */

export type ArtEntry = { width: number; height: number; widths: number[]; fallback: string };
export type ScreenEntry = { width: number; height: number };
export type ArtManifest = Record<string, ArtEntry>;
export type ScreenManifest = Record<string, ScreenEntry>;

export const ART_RE = /<!--@art\s+([\w-]+)\s+(\d+)\/(\d+)\s+"([^"]*)"([^>]*?)-->/g;
export const SCREEN_RE = /<!--@screen\s+([\w-]+)\s+(light|dark)\s+"([^"]*)"\s*-->/g;

const DEFAULT_SIZES = "(min-width: 881px) 50vw, 100vw";

export const artTag = (
  art: ArtManifest,
  name: string,
  w: string,
  h: string,
  alt: string,
  flags = ""
): string => {
  const eager = /\beager\b/.test(flags);
  const sizes = flags.match(/sizes="([^"]*)"/)?.[1] ?? DEFAULT_SIZES;
  const entry = art[name];

  if (!entry) {
    return (
      `<div class="art-slot" data-ratio="${w}/${h}" aria-hidden="true">` +
      `<span>${name}.png<br>${w}:${h}</span></div>`
    );
  }

  const srcset = (ext: string) =>
    entry.widths.map((x) => `/art/${name}-${x}.${ext} ${x}w`).join(", ");

  return `<picture class="art art--${name}">
  <source type="image/avif" srcset="${srcset("avif")}" sizes="${sizes}">
  <source type="image/webp" srcset="${srcset("webp")}" sizes="${sizes}">
  <img src="/art/${entry.fallback}" width="${entry.width}" height="${entry.height}" alt="${alt}" loading="${eager ? "eager" : "lazy"}" decoding="async"${eager ? ' fetchpriority="high"' : ""}>
</picture>`;
};

export const screenTag = (
  screens: ScreenManifest,
  board: string,
  theme: string,
  alt: string
): string => {
  const key = `${board}-${theme}`;
  const entry = screens[key];
  if (!entry) {
    throw new Error(
      `No screenshot "${key}" in public/screens/manifest.json. Add it to SCREENS in scripts/screens.mjs and run \`npm run screens\`.`
    );
  }
  return `<picture class="screen">
  <source type="image/webp" srcset="/screens/${key}.webp">
  <img src="/screens/${key}.png" width="${entry.width}" height="${entry.height}" alt="${alt}" loading="lazy" decoding="async">
</picture>`;
};

/** Resolves every `@art` and `@screen` in a page. */
export const renderImages = (html: string, art: ArtManifest, screens: ScreenManifest): string =>
  html
    .replace(ART_RE, (_, name, w, h, alt, flags) => artTag(art, name, w, h, alt, flags))
    .replace(SCREEN_RE, (_, board, theme, alt) => screenTag(screens, board, theme, alt));
