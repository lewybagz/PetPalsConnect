import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/site.css";

import { API_BASE } from "./config";
import { EMAIL, ZIP, isArizonaZip } from "./zip";

/**
 * Everything on this site that is not CSS.
 *
 * Which is: the waitlist form, a scroll-reveal fallback for browsers without
 * `animation-timeline`, and the small-screen nav disclosure. The site is
 * content and images; if this file ever grows a router or a state library,
 * something has gone wrong with the premise.
 *
 * Nothing here writes a `style` attribute. The CSP is `style-src 'self'`,
 * and one inline style would mean loosening it for the whole site.
 */

/** Marks the document so CSS can style the JS-present case only. */
document.documentElement.classList.add("js");

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const nav = document.querySelector<HTMLElement>(".nav");
const navToggle = document.querySelector<HTMLButtonElement>(".nav__toggle");
const navMenu = document.querySelector<HTMLElement>(".nav__menu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const open = navMenu.dataset.open === "true";
    navMenu.dataset.open = String(!open);
    navToggle.setAttribute("aria-expanded", String(!open));
  });
}

if (nav) {
  // A border appears once the page has moved, so the bar separates from the
  // content it is now overlapping. An IntersectionObserver on a sentinel
  // rather than a scroll listener - see the reveal note below.
  const sentinel = document.createElement("div");
  sentinel.className = "nav-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  document.body.prepend(sentinel);

  new IntersectionObserver(
    ([entry]) => {
      if (entry) nav.dataset.scrolled = String(!entry.isIntersecting);
    },
    { threshold: 0 }
  ).observe(sentinel);
}

// ---------------------------------------------------------------------------
// Scroll reveal
//
// An IntersectionObserver rather than a scroll listener: a scroll handler
// runs on every frame and is the single easiest way to make a static page
// feel slower than a heavy one. And rather than `animation-timeline: view()`
// - see the note in base.css for why that was built and then taken out.
// Each element is revealed once and then left alone.
// ---------------------------------------------------------------------------

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (!prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
  );

  for (const el of document.querySelectorAll(".reveal")) observer.observe(el);
}

// ---------------------------------------------------------------------------
// The waitlist form
// ---------------------------------------------------------------------------

const EMAIL_MESSAGE = "Enter an email address we can reach you at.";
const ZIP_MESSAGE = "Enter a five-digit ZIP code.";

const form = document.querySelector<HTMLFormElement>("#waitlist-form");

if (form) {
  const emailInput = form.querySelector<HTMLInputElement>("#waitlist-email");
  const zipInput = form.querySelector<HTMLInputElement>("#waitlist-zip");
  const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
  const status = form.querySelector<HTMLElement>("#waitlist-status");
  const emailError = form.querySelector<HTMLElement>("#waitlist-email-error");
  const zipError = form.querySelector<HTMLElement>("#waitlist-zip-error");

  /** Shows a field error, or clears it when `message` is empty. */
  const setFieldError = (
    input: HTMLInputElement | null,
    slot: HTMLElement | null,
    message: string
  ) => {
    if (slot) slot.textContent = message;
    input?.setAttribute("aria-invalid", message ? "true" : "false");
  };

  const setStatus = (message: string, kind: "ok" | "error" | "none") => {
    if (!status) return;
    status.textContent = message;
    status.className =
      kind === "none" ? "visually-hidden" : `waitlist__status waitlist__status--${kind}`;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput?.value.trim() ?? "";
    const zip = zipInput?.value.trim() ?? "";

    // Checked here so a mistyped address is answered instantly rather than
    // after a round trip. The server checks the same two things again and is
    // the one that decides - this is a convenience, never the gate.
    const emailBad = EMAIL.test(email) ? "" : EMAIL_MESSAGE;
    const zipBad = ZIP.test(zip) ? "" : ZIP_MESSAGE;

    setFieldError(emailInput, emailError, emailBad);
    setFieldError(zipInput, zipError, zipBad);

    if (emailBad || zipBad) {
      setStatus("", "none");
      (emailBad ? emailInput : zipInput)?.focus();
      return;
    }

    submit?.setAttribute("aria-busy", "true");
    if (submit) submit.disabled = true;
    setStatus("Adding you to the list...", "ok");

    try {
      const response = await fetch(`${API_BASE}/api/waitlist/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          zip,
          source: form.dataset.source || "website",
        }),
      });

      if (response.ok) {
        // Replaced rather than kept alongside: leaving the form up invites a
        // second submission, and the answer to that is already "you are on
        // it" - so say that instead of asking again.
        form.replaceChildren(successMessage(zip));
        return;
      }

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };

      if (body.code === "INVALID_EMAIL") {
        setFieldError(emailInput, emailError, EMAIL_MESSAGE);
        setStatus("", "none");
        emailInput?.focus();
        return;
      }
      if (body.code === "INVALID_ZIP") {
        setFieldError(zipInput, zipError, ZIP_MESSAGE);
        setStatus("", "none");
        zipInput?.focus();
        return;
      }

      setStatus(
        body.message || "Something went wrong at our end. Try again in a moment.",
        "error"
      );
    } catch {
      // A network failure, an origin the API does not allow, or the API being
      // down. The visitor can do nothing about any of them, so the message
      // says what to do rather than what broke.
      setStatus(
        "We could not reach the server. Check your connection and try again.",
        "error"
      );
    } finally {
      submit?.removeAttribute("aria-busy");
      if (submit) submit.disabled = false;
    }
  });
}

/**
 * What the form becomes once somebody is on the list.
 *
 * An Arizona ZIP gets a different sentence from everywhere else, because the
 * two are genuinely different situations: one is "we are already open where
 * you are", the other is "you are the reason we would come". Saying the same
 * thing to both would be wrong for one of them.
 */
function successMessage(zip: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "waitlist__status waitlist__status--ok";
  wrap.setAttribute("role", "status");

  const heading = document.createElement("h3");
  heading.textContent = "You are on the list.";

  const body = document.createElement("p");
  body.textContent = isArizonaZip(zip)
    ? "That ZIP is inside the launch area, so PetPals is already open where you are. We will email you the moment the app is on the stores."
    : "That ZIP is outside Arizona for now. You have told us where to go next, and we will email you when PetPals opens near you.";

  wrap.append(heading, body);
  return wrap;
}
