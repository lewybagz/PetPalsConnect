/**
 * Where the legal documents live.
 *
 * They are static pages in the repo's `docs/` folder, published by GitHub
 * Pages, so the same URL is what the app opens and what the store listings
 * cite. `LegalPoliciesScreen` used to render placeholder text in place of
 * both; a policy nobody can read is a review rejection on either store.
 */
const BASE = "https://lewybagz.github.io/PetPalsConnect";

export const PRIVACY_URL = `${BASE}/privacy.html`;
export const TERMS_URL = `${BASE}/terms.html`;
export const SUPPORT_EMAIL = "contact@petpalsconnectapp.com";
