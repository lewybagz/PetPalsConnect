import { PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL, STORES } from "./config";

/**
 * The nav, the store badges and the footer, as strings, injected by the
 * plugin in `vite.config.ts` at build time so four HTML files do not carry
 * four copies of them.
 *
 * Not a template engine and not a component framework: the site is four
 * static pages, and three shared strings is the whole requirement.
 */

/** The faceted mark: three planes of a clay dog tag catching the light. */
const MARK = `<svg class="nav__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16 2 4 9v14l12 7 12-7V9z" fill="#c4703f"/>
    <path d="M16 2 4 9l12 7 12-7z" fill="#d98d5f"/>
    <path d="M16 16v14l12-7V9z" fill="#9d4f27"/>
    <circle cx="16" cy="14" r="3.1" fill="#f5efe3"/>
  </svg>`;

export type NavKey = "where-we-are" | "care" | "safety" | "";

export const nav = (current: NavKey = ""): string => {
  const link = (href: string, key: NavKey, label: string) =>
    `<li><a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a></li>`;

  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="nav">
  <div class="wrap nav__inner">
    <a class="nav__brand" href="/">${MARK}<span>PetPals</span></a>

    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-menu">
      Menu
    </button>

    <nav class="nav__menu" id="nav-menu" aria-label="Main">
      <ul class="nav__links">
        ${link("/where-we-are/", "where-we-are", "Where we are")}
        ${link("/care/", "care", "Care hub")}
        ${link("/safety/", "safety", "Safety")}
        <li><a class="btn btn--primary nav__cta" href="/#waitlist">Join the list</a></li>
      </ul>
    </nav>
  </div>
</header>`;
};

/**
 * A store badge.
 *
 * A real link once `STORES.<platform>.live` is true, and a greyed panel
 * until then. `aria-disabled` alone would leave a link in the tab order
 * pointing nowhere, so the disabled version is a `div`: it is not a control,
 * because there is nothing to control yet.
 *
 * Text only, on purpose. Apple and Google both require their own badge
 * artwork on a live download link, and a hand-drawn logo on a dead one is
 * the worst of both. See `STORES` in config.ts for what happens at launch.
 */
const storeBadge = (platform: "ios" | "android", small: string): string => {
  const store = STORES[platform];
  const inner = `<span class="store-badge__small">${store.live ? small : "Coming soon"}</span>
    <span class="store-badge__big">${store.label}</span>`;

  return store.live
    ? `<a class="store-badge" href="${store.url}">${inner}</a>`
    : `<div class="store-badge" aria-disabled="true">${inner}</div>`;
};

export const stores = (): string =>
  `<div class="stores">
    ${storeBadge("ios", "Download on the")}
    ${storeBadge("android", "Get it on")}
  </div>`;

export const footer = (): string => `<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div>
        <a class="nav__brand" href="/">${MARK}<span>PetPals</span></a>
        <p class="footer__blurb">
          Playdates for dogs, and a care hub for every pet in the house.
        </p>
      </div>

      <div>
        <h2>The app</h2>
        <ul>
          <li><a href="/#playdates">Playdates</a></li>
          <li><a href="/care/">Care hub</a></li>
          <li><a href="/safety/">Safety</a></li>
          <li><a href="/where-we-are/">Where we are</a></li>
        </ul>
      </div>

      <div>
        <h2>Legal</h2>
        <ul>
          <li><a href="${PRIVACY_URL}">Privacy policy</a></li>
          <li><a href="${TERMS_URL}">Terms of service</a></li>
        </ul>
      </div>

      <div>
        <h2>Support</h2>
        <ul>
          <li><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></li>
        </ul>
      </div>
    </div>

    <div class="footer__bottom">
      <span>&copy; ${new Date().getFullYear()} Tovuti LLC</span>
      <span>Open across Arizona. Only Arizona, for now.</span>
    </div>
  </div>
</footer>`;
