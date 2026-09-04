/**
 * When a drag becomes a decision.
 *
 * Pure, and separate from the screen, for the same reason
 * `services/matching/score.js` is pure and separate from its controller: this
 * is the part with rules in it, and rules are worth testing directly. A test
 * cannot perform a real pan - React Native Testing Library has no gesture
 * simulator and the handlers run on the UI thread - so if the thresholds lived
 * inside `onEnd` they would be untestable, which in practice means untested.
 *
 * The numbers are the whole feature. Too low a threshold and the deck decides
 * for you when you were only peeking at the next card; too high and a
 * confident flick springs back and feels broken.
 */

/** Past a quarter of the screen, a drag is a decision. */
export const DISTANCE_RATIO = 0.25;

/**
 * A fast flick counts however far it travelled.
 *
 * Points per second. Somebody who flicks hard has decided, and their thumb
 * often leaves the glass before a quarter of the screen - judging that by
 * distance alone rejects the most deliberate gesture on the screen.
 */
export const VELOCITY_THRESHOLD = 800;

/** How far the card leans at a full throw, in degrees. */
export const MAX_ROTATION = 8;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * The decision a released drag makes, or null to spring back.
 *
 * Direction comes from velocity when the flick is decisive and from
 * displacement otherwise. They disagree more often than it sounds: dragging a
 * card right, changing your mind and throwing it left leaves a positive
 * displacement and a negative velocity, and the thing the person just did with
 * their thumb is the left throw.
 */
export const decisionFor = ({ translationX = 0, velocityX = 0, width = 0 } = {}) => {
  if (!width) return null;

  const flicked = Math.abs(velocityX) >= VELOCITY_THRESHOLD;
  const dragged = Math.abs(translationX) >= width * DISTANCE_RATIO;

  if (!flicked && !dragged) return null;

  const direction = flicked ? velocityX : translationX;
  if (direction === 0) return null;

  return direction > 0 ? "like" : "pass";
};

/**
 * The card's lean, in degrees, for a given displacement.
 *
 * Tied to distance rather than to the decision, so the card is already leaning
 * before the threshold is crossed - which is what tells somebody mid-drag that
 * the gesture is being received at all.
 */
export const rotationFor = (translationX = 0, width = 0) => {
  if (!width) return 0;
  return clamp((translationX / width) * MAX_ROTATION * 2, -MAX_ROTATION, MAX_ROTATION);
};

/**
 * How solid the LIKE / NOPE stamp is, 0 to 1.
 *
 * Reaches full strength exactly at the distance threshold, so the stamp
 * arriving *is* the feedback that letting go now will commit. A stamp that
 * faded in over the whole width would say nothing about where the line is.
 */
export const stampOpacity = (translationX = 0, width = 0) => {
  if (!width) return 0;
  return clamp(Math.abs(translationX) / (width * DISTANCE_RATIO), 0, 1);
};

/** Which stamp a displacement shows, or null while the card is near centre. */
export const stampFor = (translationX = 0) => {
  if (translationX === 0) return null;
  return translationX > 0 ? "like" : "pass";
};
