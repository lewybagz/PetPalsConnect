import tw from "twrnc";

/**
 * Tailwind-style utility classes for React Native.
 *
 * The codebase calls `const tailwind = useTailwind()` then `tailwind("flex-1")`.
 * That hook was imported from the nativewind package, which has never exported
 * one, so every screen using it threw on render. twrnc provides exactly this
 * call shape, so the 200+ existing call sites keep working unchanged.
 *
 * Swapping the styling library later means changing this one file.
 */
export const useTailwind = () => tw;

export default tw;
