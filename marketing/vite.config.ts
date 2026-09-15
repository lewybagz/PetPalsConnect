import { defineConfig, type Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { nav, footer, stores, type NavKey } from "./src/partials";
import { renderImages, type ArtManifest, type ScreenManifest } from "./src/placeholders";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

/**
 * The site's placeholders, resolved at build time:
 *
 *   <!--@nav:where-we-are-->   the header, with that link current
 *   <!--@stores-->             the store badges
 *   <!--@footer-->             the footer
 *   <!--@art …-->              an illustration, or a slot for one (placeholders.ts)
 *   <!--@screen …-->           a gallery screenshot in a phone (placeholders.ts)
 *
 * Four static pages sharing a header and a footer is the entire templating
 * requirement here, and this is the whole of it.
 *
 * A placeholder naming something that does not exist throws rather than
 * quietly leaving a comment in the output. A footer silently missing from
 * one page is exactly the kind of thing nobody notices until a store
 * reviewer cannot find the privacy link.
 */

const manifest = <T>(file: string): Record<string, T> =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, T>) : {};

const partials = (): Plugin => ({
  name: "petpals-partials",
  transformIndexHtml: {
    order: "pre",
    handler(html) {
      const art = manifest<ArtManifest[string]>(resolve(ROOT, "public/art/manifest.json"));
      const screens = manifest<ScreenManifest[string]>(resolve(ROOT, "public/screens/manifest.json"));

      const out = renderImages(
        html
          .replace(/<!--@nav:([\w-]*)-->/g, (_, key: string) => nav(key as NavKey))
          .replace(/<!--@stores-->/g, () => stores())
          .replace(/<!--@footer-->/g, () => footer()),
        art,
        screens
      );

      const stray = out.match(/<!--@[^>]*-->/);
      if (stray) {
        throw new Error(`Unresolved placeholder ${stray[0]}. Known: nav, stores, footer, art, screen.`);
      }
      return out;
    },
  },
});

export default defineConfig({
  plugins: [partials()],
  appType: "mpa",
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolve(ROOT, "index.html"),
        whereWeAre: resolve(ROOT, "where-we-are/index.html"),
        safety: resolve(ROOT, "safety/index.html"),
        care: resolve(ROOT, "care/index.html"),
      },
    },
  },
});
