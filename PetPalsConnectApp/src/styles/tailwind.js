import tw from "twrnc";

/**
 * Tailwind-style utility classes for React Native.
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
 */

/** Accepts a class string, an array, or twrnc's conditional-object form. */
const tailwind = (...args) => tw.style(...args);

export const useTailwind = () => tailwind;

export { tw };
export default tailwind;
