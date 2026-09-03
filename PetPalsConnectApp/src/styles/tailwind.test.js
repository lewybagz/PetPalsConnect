import { useTailwind, tw } from "./tailwind";

/**
 * These exist because the previous shim called twrnc's default export with a
 * plain string. That export is a template tag, so every one of the 200+
 * `tailwind("...")` call sites threw at render time - and bundling never
 * caught it, because bundling does not execute the code.
 */
describe("useTailwind", () => {
  const tailwind = useTailwind();

  it("accepts a plain class string", () => {
    expect(() => tailwind("flex-1 p-4")).not.toThrow();
  });

  it("resolves classes to real style values", () => {
    expect(tailwind("flex-1")).toMatchObject({ flexGrow: 1 });
    expect(tailwind("p-4")).toMatchObject({ paddingTop: 16 });
  });

  it("composes multiple classes into one style object", () => {
    const style = tailwind("flex-1 p-4");
    expect(style.flexGrow).toBe(1);
    expect(style.paddingTop).toBe(16);
  });

  it("accepts the conditional forms screens use", () => {
    expect(() => tailwind("py-4", "bg-red-500")).not.toThrow();
    expect(() => tailwind(`rounded-lg ${true ? "bg-red-500" : "bg-gray-300"}`)).not.toThrow();
  });

  it("returns the same callable on every call, so it is stable across renders", () => {
    expect(useTailwind()).toBe(useTailwind());
  });

  it("still exposes twrnc itself for anything needing the template form", () => {
    expect(typeof tw).toBe("function");
  });
});
