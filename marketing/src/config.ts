/**
 * The handful of things the site needs to know about the world outside it.
 *
 * One file, because the riskiest item here is a launch-day flip that is easy
 * to forget: the store badges render disabled until the listings exist, and
 * nothing about a greyed badge fails a build or a test. Keeping it beside the
 * URLs means the flip is one diff in one place.
 */

/**
 * Where the API is.
 *
 * `VITE_API_BASE` at build time; the production host otherwise. Vite inlines
 * this, so it is public by definition - the same rule as the app's
 * `EXPO_PUBLIC_*` variables. Nothing secret goes here.
 *
 * Guarded because this module is also loaded by `vite.config.ts` (through
 * `partials.ts`) under plain Node, where `import.meta.env` does not exist.
 * The build never needs the value; the page does.
 */
export const API_BASE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) ??
  "https://api.petpalsconnectapp.com";

/**
 * The legal documents, hosted by GitHub Pages out of the repo's `docs/`.
 *
 * The same URLs the app's `src/config/legal.ts` names and both store listings
 * cite. The site links out rather than hosting a copy: a second copy is a
 * second document that drifts, which is exactly why the app stopped embedding
 * them.
 */
const LEGAL_BASE = "https://lewybagz.github.io/PetPalsConnect";
export const PRIVACY_URL = `${LEGAL_BASE}/privacy.html`;
export const TERMS_URL = `${LEGAL_BASE}/terms.html`;

export const SUPPORT_EMAIL = "contact@petpalsconnectapp.com";

/**
 * The store listings.
 *
 * LAUNCH WORK: when a listing goes live, put its URL here and set `live` to
 * true. That is the whole flip - the badge markup reads these. Until then the
 * badges render greyed and say "coming soon", because a badge that looks
 * tappable and does nothing is worse than one that admits it is not ready.
 */
export const STORES = {
  ios: { live: false, url: "", label: "App Store" },
  android: { live: false, url: "", label: "Google Play" },
} as const;
