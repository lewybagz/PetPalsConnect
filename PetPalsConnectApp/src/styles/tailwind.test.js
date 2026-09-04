import React from "react";
import { Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";

import { useTailwind, tailwindFor, tw } from "./tailwind";
import { AppThemeProvider } from "../context/AppThemeContext";
import { dark, light } from "./tokens";

/**
 * These exist because the previous shim called twrnc's default export with a
 * plain string. That export is a template tag, so every one of the 200+
 * `tailwind("...")` call sites threw at render time - and bundling never
 * caught it, because bundling does not execute the code.
 *
 * `useTailwind` is a real hook now that it resolves against the active theme,
 * so it is exercised through a render rather than called at module scope.
 */

/** Captures what a screen would get from the hook. */
let captured;
const Probe = () => {
  captured = useTailwind();
  return <Text testID="probe">ok</Text>;
};

const renderProbe = async (ui = <Probe />) => {
  captured = null;
  await render(<AppThemeProvider>{ui}</AppThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("probe")).toBeTruthy());
  return captured;
};

describe("useTailwind", () => {
  it("accepts a plain class string", async () => {
    const tailwind = await renderProbe();
    expect(() => tailwind("flex-1 p-4")).not.toThrow();
  });

  it("resolves classes to real style values", async () => {
    const tailwind = await renderProbe();
    expect(tailwind("flex-1")).toMatchObject({ flexGrow: 1 });
    expect(tailwind("p-4")).toMatchObject({ paddingTop: 16 });
  });

  it("composes multiple classes into one style object", async () => {
    const tailwind = await renderProbe();
    const style = tailwind("flex-1 p-4");
    expect(style.flexGrow).toBe(1);
    expect(style.paddingTop).toBe(16);
  });

  it("accepts the conditional forms screens use", async () => {
    const tailwind = await renderProbe();
    expect(() => tailwind("py-4", "bg-red-500")).not.toThrow();
    expect(() =>
      tailwind(`rounded-lg ${true ? "bg-red-500" : "bg-gray-300"}`)
    ).not.toThrow();
  });

  it("returns the same callable for a theme, so it is stable across renders", () => {
    // A new function identity every render would invalidate every useMemo and
    // useCallback that closes over it.
    expect(tailwindFor("light")).toBe(tailwindFor("light"));
  });

  it("defaults to light outside a provider rather than throwing", async () => {
    captured = null;
    await render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("probe")).toBeTruthy());

    expect(captured("bg-surface").backgroundColor).toBe(light.surface);
  });

  it("hands a different palette to the same class under a dark theme", () => {
    expect(tailwindFor("dark")("bg-surface").backgroundColor).toBe(dark.surface);
    expect(tailwindFor("light")("bg-surface").backgroundColor).toBe(light.surface);
  });

  it("still exposes twrnc itself for anything needing the template form", () => {
    expect(typeof tw).toBe("function");
  });
});
