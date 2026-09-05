/**
 * The one description of what this app looks like.
 *
 * Before this file the app held 185 hex literals across 55 files, 15 different
 * padding values, 11 border radii and 9 font sizes - all typed at the point of
 * use. Two unrelated blues both acted as "primary": Bootstrap's `#007bff` in
 * eleven files and Tailwind's `#2563eb` in four. Nothing was wrong with any one
 * of them; the problem is that "the card padding" and "the primary blue" were
 * not things you could change, because they were not things that existed.
 *
 * TypeScript from the start, because this is exactly the module CLAUDE.md's
 * conversion order asks for first: a pure leaf with no React and no native
 * dependency, whose types flow out to every caller.
 *
 * Every colour pairing below was computed with the WCAG relative-luminance
 * formula and passes AA for its role. Seven of the greys this replaces did not:
 * `#a1a1a1` captions sat at 2.58:1, and white text on the `#007bff` primary
 * button - the most-pressed control in the app - at 3.98:1.
 */

/** A theme is these keys and no others, so light and dark cannot drift. */
export type Palette = {
  /** Behind everything. Screens paint this. */
  bg: string;
  /** Cards, sheets, rows - the raised plane. */
  surface: string;
  /** A recessed panel on `surface`: inputs, wells, disabled fills. */
  surfaceAlt: string;

  /** Body copy and headings. 15:1+ on `surface`. */
  text: string;
  /** Secondary copy: captions, timestamps, helper text. AA at body size. */
  textMuted: string;
  /** Placeholder and decorative only - never load-bearing text. */
  textFaint: string;
  /** Text on a `primary` fill. */
  onPrimary: string;

  /** Hairlines and dividers. Decorative, so it is not held to 3:1. */
  border: string;
  /** The outline of a control you can interact with. 3:1 or better. */
  borderStrong: string;

  /** Buttons, links, selection. */
  primary: string;
  /** A primary-tinted background: selected rows, badges, soft buttons. */
  primarySoft: string;

  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;

  /**
   * A switch, which is the one control that cannot borrow its colours.
   *
   * Everything else here is a surface, a text tone or a fill. A switch is a
   * knob on a track, and both need to read against each other *and* against
   * the surface behind them - three relationships no existing token was chosen
   * for. `success` cannot be the on-track: in dark it is a mint green a white
   * knob disappears into at 1.7:1.
   */
  switchOn: string;
  switchOff: string;
  switchKnob: string;

  /** Skeleton placeholders and other "not here yet" fills. */
  skeleton: string;
  /** Scrims behind modals and sheets. */
  scrim: string;
};

export const light: Palette = {
  bg: "#F8F9FB",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F3F6",

  text: "#16181D", // 17.8:1 on surface
  textMuted: "#5B6270", // 6.1:1 on surface, 5.5:1 on surfaceAlt
  textFaint: "#8A909B", // 3.2:1 - placeholders only
  onPrimary: "#FFFFFF", // 5.2:1 on primary

  border: "#D8DCE3",
  borderStrong: "#767C88", // 4.2:1 on surface

  primary: "#2563EB", // 5.2:1 on surface. Replaces #007bff (3.98:1)
  primarySoft: "#EDF2FE", // 4.6:1 with primary on top

  danger: "#B3261E", // 6.5:1
  dangerSoft: "#FBE9E7",
  success: "#1B6E3C", // 6.3:1
  successSoft: "#E4F2E8",
  warning: "#8A5A00", // 5.9:1
  warningSoft: "#FBF0DC",

  // Green rather than the primary blue: a switch reports state, and every
  // button in the app is already blue. 6.3:1 against the knob.
  switchOn: "#1B6E3C",
  switchOff: "#8A909B",
  switchKnob: "#FFFFFF",

  skeleton: "#E7EAEF",
  scrim: "rgba(10, 12, 16, 0.55)",
};

/**
 * Dark is not "light with the colours inverted".
 *
 * A saturated blue that reads well on white glows on near-black, so `primary`
 * lightens and `onPrimary` flips dark - a filled button in dark mode is a light
 * fill with dark text, not the reverse.
 */
export const dark: Palette = {
  bg: "#0F1013",
  surface: "#14161A",
  surfaceAlt: "#1C1F25",

  text: "#E9EBF0", // 15.2:1 on surface
  textMuted: "#A2A8B4", // 7.6:1 on surface
  textFaint: "#767C88",
  onPrimary: "#0F1013", // 8.8:1 on primary

  border: "#2A2E36",
  borderStrong: "#8B929E", // 5.8:1 on surface

  primary: "#8AB0FF", // 8.4:1 on surface
  primarySoft: "#1B2436",

  danger: "#FF9A90", // 8.9:1
  dangerSoft: "#2C1A18",
  success: "#6FD08C", // 9.6:1
  successSoft: "#152619",
  warning: "#E0B457", // 9.4:1
  warningSoft: "#2A2213",

  // The knob stays near-white in dark too, so the tracks are pinned to the ends
  // of a narrow band: both must clear 3:1 against that knob *and* against the
  // surface, which leaves only L 0.124-0.268 to work in. On sits at the top of
  // it and off at the bottom, which is the most on/off separation the band
  // allows - 1.72:1 against a ceiling of 1.83:1. `success` cannot be the
  // on-track: in dark it is a mint the knob vanishes into at 1.7:1.
  switchOn: "#2E9E5B",
  switchOff: "#5D6575",
  switchKnob: "#F2F4F8",

  skeleton: "#22262D",
  scrim: "rgba(0, 0, 0, 0.66)",
};

/**
 * Six steps, all multiples of four.
 *
 * The app's real histogram had fifteen values, and `10` alone appeared 98
 * times - a default that spread by copy-paste rather than by decision. Off-scale
 * values (3, 5, 15, 22, 35) exist because somebody eyeballed a gap once.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Three roles rather than eleven numbers: what is this thing, not how round. */
export const radius = {
  control: 8,
  card: 12,
  pill: 999,
} as const;

/**
 * The floor for anything you can tap.
 *
 * Apple's HIG asks 44pt, Material 48dp, WCAG 2.2 SC 2.5.8 24x24px. The primary
 * button missed all three: its padding lived on an outer `Animated.View` while
 * `onPress` sat on a `TouchableOpacity` inside it with no padding of its own,
 * so taps landing in the visible blue did nothing.
 */
export const hit = { min: 44 } as const;

/**
 * Six named text styles in place of nine ad-hoc sizes.
 *
 * `maxScale` caps Dynamic Type per role rather than switching it off: roughly a
 * third of iOS users run a non-default text size, and a row that must not wrap
 * still has to grow some. Headings cap tighter than body because they are
 * already large and are the first thing to overflow.
 */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700", maxScale: 1.4 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "600", maxScale: 1.5 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400", maxScale: 1.8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600", maxScale: 1.6 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400", maxScale: 1.6 },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: "400", maxScale: 1.5 },
} as const;

export type TypeRole = keyof typeof type;
export type SpaceStep = keyof typeof space;
export type RadiusRole = keyof typeof radius;
export type ThemeName = "light" | "dark";

export const palettes: Record<ThemeName, Palette> = { light, dark };

/** Every semantic colour name, for the tests and the lint rule that guard this. */
export const COLOR_TOKENS = Object.keys(light) as (keyof Palette)[];
