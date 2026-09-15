import { test } from "node:test";
import assert from "node:assert/strict";

import { artTag, screenTag, renderImages, type ArtManifest } from "./placeholders.ts";
import { isArizonaZip, EMAIL, ZIP } from "./zip.ts";

/**
 * The site's logic, which is small and all of it on a boundary: what the
 * build turns a placeholder into, and what the form lets through.
 *
 * Run with `node --test`; Node strips the types itself. No runner, no
 * transpiler, no dependency - the site has one piece of interactive state
 * and does not need a test framework to check it.
 */

const HERO: ArtManifest = {
  hero: { width: 1600, height: 1200, widths: [480, 800, 1600], fallback: "hero-1600.jpg" },
};

test("an illustration that exists becomes a picture with every width the build made", () => {
  const html = artTag(HERO, "hero", "4", "3", "Two dogs", 'eager sizes="40vw"');

  assert.match(html, /<picture class="art art--hero">/);
  assert.match(html, /image\/avif" srcset="\/art\/hero-480\.avif 480w, \/art\/hero-800\.avif 800w, \/art\/hero-1600\.avif 1600w" sizes="40vw"/);
  assert.match(html, /image\/webp" srcset="\/art\/hero-480\.webp 480w/);
  // Dimensions on the fallback, so nothing shifts when it arrives.
  assert.match(html, /<img src="\/art\/hero-1600\.jpg" width="1600" height="1200" alt="Two dogs"/);
  // The hero is the LCP element and says so.
  assert.match(html, /loading="eager"/);
  assert.match(html, /fetchpriority="high"/);
});

test("an illustration that has not arrived is a labelled slot at the right ratio, lazy by default", () => {
  const html = artTag({}, "arizona", "4", "3", "A desert");

  assert.equal(
    html,
    '<div class="art-slot" data-ratio="4/3" aria-hidden="true"><span>arizona.png<br>4:3</span></div>'
  );

  const lazy = artTag(HERO, "hero", "4", "3", "Two dogs");
  assert.match(lazy, /loading="lazy"/);
  assert.doesNotMatch(lazy, /fetchpriority/);
  assert.match(lazy, /sizes="\(min-width: 881px\) 50vw, 100vw"/);
});

test("a screenshot the build did not copy is a build error, not a broken image", () => {
  const screens = { "discover-light": { width: 780, height: 1688 } };

  assert.match(
    screenTag(screens, "discover", "light", "The deck"),
    /<img src="\/screens\/discover-light\.png" width="780" height="1688" alt="The deck"/
  );
  assert.throws(() => screenTag(screens, "first-run", "light", "x"), /No screenshot "first-run-light"/);
});

test("renderImages resolves both placeholders in a page and leaves the rest alone", () => {
  const page = `<p>before</p>
<!--@art hero 4/3 "Two dogs" eager-->
<div class="phone"><!--@screen discover light "The deck"--></div>
<!--@footer-->`;

  const out = renderImages(page, HERO, { "discover-light": { width: 780, height: 1688 } });

  assert.match(out, /<picture class="art art--hero">/);
  assert.match(out, /<picture class="screen">/);
  assert.doesNotMatch(out, /<!--@art|<!--@screen/);
  // Not this module's placeholder; the config plugin handles it after.
  assert.match(out, /<!--@footer-->/);
});

test("the Arizona check matches the backend's prefix table, gaps included", () => {
  // One from each USPS range: Phoenix, Tucson, Flagstaff, Kingman.
  for (const zip of ["85004", "85701", "86001", "86401"]) {
    assert.equal(isArizonaZip(zip), true, zip);
  }
  // Elsewhere, and the unassigned 854 gap inside Arizona's range.
  for (const zip of ["90210", "10001", "85400", "86200"]) {
    assert.equal(isArizonaZip(zip), false, zip);
  }
  for (const bad of ["8500", "850011", "ABCDE", ""]) {
    assert.equal(isArizonaZip(bad), false, bad);
  }
});

test("the form's own checks agree with the server's on what is obviously wrong", () => {
  assert.equal(ZIP.test("85004"), true);
  assert.equal(ZIP.test("8500"), false);
  assert.equal(EMAIL.test("dana@example.com"), true);
  for (const bad of ["", "not-an-email", "a@b", "no at sign.com"]) {
    assert.equal(EMAIL.test(bad), false, bad);
  }
});
