import {
  COLOR_TOKENS,
  dark,
  hit,
  light,
  radius,
  space,
  type,
} from "./tokens";
import { tailwindFor } from "./tailwind";

/**
 * The tokens have to keep the promises their comments make.
 *
 * The survey that prompted this work found seven greys used for body text
 * failing WCAG AA - `#a1a1a1` captions at 2.58:1, `#9ca3af` placeholders at
 * 2.54:1 - and white on the `#007bff` primary button at 3.98:1, below AA for
 * the label on the app's most-pressed control. None of that is visible to lint,
 * types or a passing test suite: the code reads perfectly well.
 *
 * So the ratios are computed here rather than trusted. Picking a prettier grey
 * later fails this file.
 */

/** WCAG 2.x relative luminance. */
const luminance = (hex) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4]
    .map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Body text, and anything below 18pt. */
const AA_TEXT = 4.5;
/** UI components, focus rings, and text at 18pt+ or 14pt bold. */
const AA_LARGE = 3;

describe.each([
  ["light", light],
  ["dark", dark],
])("%s palette", (name, palette) => {
  it.each([
    ["text", "surface"],
    ["text", "bg"],
    ["text", "surfaceAlt"],
    ["textMuted", "surface"],
    ["textMuted", "bg"],
    ["textMuted", "surfaceAlt"],
    ["primary", "surface"],
    ["danger", "surface"],
    ["success", "surface"],
    ["warning", "surface"],
  ])("%s on %s clears AA for body text", (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("a label on a primary fill is readable", () => {
    // 3.98:1 is what white on #007bff scored. That was the button people press
    // most, and the failure is invisible because the button looks fine.
    expect(contrast(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(
      AA_TEXT
    );
  });

  it.each(["danger", "success", "warning", "primary"])(
    "%s reads on its own soft background",
    (role) => {
      expect(contrast(palette[role], palette[`${role}Soft`])).toBeGreaterThanOrEqual(
        AA_TEXT
      );
    }
  );

  it("the outline of a control clears the 3:1 UI threshold", () => {
    expect(contrast(palette.borderStrong, palette.surface)).toBeGreaterThanOrEqual(
      AA_LARGE
    );
  });

  it("has every key the other palette has, so a theme cannot half-exist", () => {
    expect(Object.keys(palette).sort()).toEqual([...COLOR_TOKENS].sort());
  });
});

describe("scales", () => {
  it("every spacing step is a multiple of four", () => {
    // The app's real histogram had fifteen values; `10` alone appeared 98 times
    // and 3, 5, 15, 22 and 35 existed because somebody eyeballed a gap.
    for (const value of Object.values(space)) {
      expect(value % 4).toBe(0);
    }
  });

  it("spacing ascends, so a bigger name is a bigger gap", () => {
    const values = Object.values(space);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("radii are named for roles, not sizes", () => {
    expect(Object.keys(radius)).toEqual(["control", "card", "pill"]);
  });

  it("the tap-target floor is at least Apple's 44pt", () => {
    expect(hit.min).toBeGreaterThanOrEqual(44);
  });

  it("every text role caps Dynamic Type rather than switching it off", () => {
    for (const role of Object.values(type)) {
      expect(role.maxScale).toBeGreaterThan(1);
      expect(role.lineHeight).toBeGreaterThan(role.fontSize);
    }
  });
});

describe("the styling seam", () => {
  it("resolves a token colour class", () => {
    expect(tailwindFor("light")("bg-primary")).toEqual(
      expect.objectContaining({ backgroundColor: light.primary })
    );
  });

  it("gives the same class a different value per theme", () => {
    // This is the whole reason there are two instances: a screen says
    // `bg-surface` once and means the right thing in both themes.
    expect(tailwindFor("light")("bg-surface").backgroundColor).toBe(light.surface);
    expect(tailwindFor("dark")("bg-surface").backgroundColor).toBe(dark.surface);
  });

  it("resolves a token spacing class", () => {
    // twrnc expands `p-*` to the four sides rather than the shorthand.
    expect(tailwindFor("light")("p-lg")).toEqual(
      expect.objectContaining({
        paddingTop: space.lg,
        paddingBottom: space.lg,
        paddingLeft: space.lg,
        paddingRight: space.lg,
      })
    );
  });

  it("resolves a token radius class", () => {
    expect(tailwindFor("light")("rounded-card")).toEqual(
      expect.objectContaining({ borderRadius: radius.card })
    );
  });

  it("still resolves the plain utility classes the app already uses", () => {
    // 41 files are written against stock Tailwind names. Extending the config
    // must not take those away, or the migration has to be atomic.
    expect(tailwindFor("light")("flex-1").flexGrow).toBe(1);
    expect(tailwindFor("light")("flex-row").flexDirection).toBe("row");
    expect(tailwindFor("light")("text-white").color).toBe("#fff");
  });

  it("an unknown theme name falls back to light rather than throwing", () => {
    expect(tailwindFor(undefined)("bg-surface").backgroundColor).toBe(light.surface);
  });
});
