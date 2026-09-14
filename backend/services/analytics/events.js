/**
 * The one table of what an analytics event is.
 *
 * Same idiom as `notificationTypes.js`, `reportStates.js` and `picks.js`: a
 * table in the source, not a collection. An event name that is not here cannot
 * be written, which is the whole point - notifications shipped with two `type`
 * vocabularies (a stored one invented at each call site and a different one in
 * the pushes) and settings shipped as three shapes that disagreed. A funnel
 * assembled from names each screen made up is a funnel that cannot be counted.
 *
 * A file with no imports, because the model validates against it and the
 * controller validates against it, and the model would otherwise have to
 * require the controller's neighbourhood.
 *
 * What is deliberately absent from every event: anything identifying a device.
 * No advertising id, no IP, no install id. The account is already known from
 * the token; nothing here is a second way to recognise somebody, which is what
 * keeps this first-party product analytics rather than tracking.
 */

/**
 * The onboarding funnel, in order.
 *
 * `order` is what makes a funnel countable: the aggregation reports these as
 * steps rather than as an unordered pile of counts, and a step with nobody in
 * it is a step people are falling out before - which is the entire question
 * this table exists to answer.
 *
 * The gap between `account_created` and `profile_created` is the one worth
 * watching hardest. It is the zombie-account window `AuthSessionContext` was
 * built to survive, and industry data says signup is decided inside ninety
 * seconds (CleverTap Fintech Benchmark 2022: 70% of signups happen within 75
 * seconds of first launch), so a drop there is a drop we never see again.
 */
const FUNNEL = {
  app_opened: 1,
  signup_started: 2,
  account_created: 3,
  profile_started: 4,
  profile_created: 5,
  pet_started: 6,
  pet_created: 7,
  pet_skipped: 7,
  onboarding_completed: 8,
  first_swipe: 9,
  first_match: 10,
};

/**
 * Everything else worth counting, which is not a funnel step.
 *
 * The push pair is here rather than in `FUNNEL` because it is not a stage
 * somebody passes through - it is one question asked once, whose answer decides
 * whether any re-engagement in this app can reach them at all. On iOS the
 * system prompt fires once, permanently, so `push_permission_result` is the
 * single least recoverable number in the product.
 *
 * `deck_emptied` is the cold-start signal: an Arizona-only launch means a real
 * user can exhaust everybody in range in one sitting, and this is how we find
 * out how often that happens before deciding what to do about it.
 */
const SIGNALS = [
  "push_primer_shown",
  "push_permission_result",
  "deck_emptied",
];

/** Every name that may be written. */
const EVENT_NAMES = [...Object.keys(FUNNEL), ...SIGNALS];

const isEventName = (name) => EVENT_NAMES.includes(name);

/**
 * The funnel steps in order, deduplicated.
 *
 * `pet_created` and `pet_skipped` share step 7 on purpose: they are two ways
 * of answering the same prompt and both continue to step 8. Counting them as
 * separate stages would show a cliff at whichever one the user did not take.
 */
const FUNNEL_STEPS = [...new Set(Object.values(FUNNEL))]
  .sort((a, b) => a - b)
  .map((order) => ({
    order,
    names: Object.keys(FUNNEL).filter((name) => FUNNEL[name] === order),
  }));

module.exports = { FUNNEL, SIGNALS, EVENT_NAMES, isEventName, FUNNEL_STEPS };
