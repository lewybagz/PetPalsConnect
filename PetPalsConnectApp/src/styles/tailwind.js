import { create } from "twrnc";

import { useAppTheme } from "../context/AppThemeContext";
import { dark, light, radius, space, type } from "./tokens";

/**
 * Tailwind-style utility classes for React Native, bound to the design tokens.
 *
 * The codebase calls `const tailwind = useTailwind()` then `tailwind("flex-1")`.
 * That hook was imported from the nativewind package, which has never exported
 * one, so every screen using it threw on render. twrnc replaces it.
 *
 * Note the indirection through `tw.style`: twrnc's default export is a
 * *template tag* (tw`flex-1`), so calling it with an ordinary string throws
 * "strings.forEach is not a function". `tw.style()` is the call-with-a-string
 * form, and it takes the same class strings, arrays and conditional objects.
 *
 * Swapping the styling library later means changing this one file.
 *
 * ## Why two instances rather than `dark:` variants
 *
 * twrnc resolves a class to a value from a static config, so `bg-surface` can
 * only ever mean one colour per instance. The usual workaround is to write
 * `bg-surface dark:bg-surface-dark` at 200 call sites, which is the same
 * duplication the tokens exist to remove.
 *
 * Instead there are two configured instances - identical class names, different
 * palettes - and `useTailwind()` hands back whichever matches the active theme.
 * Every file that already calls the hook becomes theme-aware without being
 * edited, and a screen never mentions light or dark at all.
 */

/** Token scales become Tailwind scales, so `p-md` and `rounded-card` resolve. */
const configFor = (palette) => ({
  theme: {
    extend: {
      colors: palette,
      // twrnc parses spacing values as CSS lengths, so a bare number throws
      // "value.match is not a function" the first time `p-md` is resolved.
      spacing: Object.fromEntries(
        Object.entries(space).map(([step, value]) => [step, `${value}px`])
      ),
      borderRadius: radius,
      fontSize: Object.fromEntries(
        Object.entries(type).map(([role, style]) => [
          role,
          [style.fontSize, { lineHeight: style.lineHeight }],
        ])
      ),
    },
  },
});

const instances = {
  light: create(configFor(light)),
  dark: create(configFor(dark)),
};

const bind = (tw) => {
  /** Accepts a class string, an array, or twrnc's conditional-object form. */
  const tailwind = (...args) => tw.style(...args);
  tailwind.color = (name) => tw.color(name);
  return tailwind;
};

const bound = {
  light: bind(instances.light),
  dark: bind(instances.dark),
};

/**
 * The styling function for a theme name.
 *
 * Exported plainly as well as through the hook, because a few things that need
 * a colour are not components - a navigator's `screenOptions`, a status-bar
 * style - and cannot call hooks.
 */
export const tailwindFor = (theme) => bound[theme === "dark" ? "dark" : "light"];

export const useTailwind = () => tailwindFor(useAppTheme().theme);

export const tw = instances.light;
export default bound.light;
