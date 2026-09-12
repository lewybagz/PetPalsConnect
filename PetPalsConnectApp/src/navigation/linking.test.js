import fs from "fs";
import path from "path";

import { SCHEME, linking } from "./linking";

/**
 * A deep link is a contract between three files that never import each
 * other: `app.json` declares the scheme, this config maps paths to routes,
 * and `AppStack` registers the routes. Drift between any two is silent - the
 * link opens the app and goes nowhere.
 */
const APP_JSON = path.resolve(__dirname, "../../app.json");
const APP_STACK = path.resolve(__dirname, "../screens/navigation/AppStack.js");

describe("deep links", () => {
  it("uses the scheme app.json declares", () => {
    const { expo } = JSON.parse(fs.readFileSync(APP_JSON, "utf8"));
    expect(expo.scheme).toBe(SCHEME);
    expect(linking.prefixes).toContain(`${expo.scheme}://`);
  });

  it("names only routes AppStack registers", () => {
    const source = fs.readFileSync(APP_STACK, "utf8");
    const registered = new Set([...source.matchAll(/name="(\w+)"/g)].map((m) => m[1]));

    for (const route of Object.keys(linking.config.screens.App.screens)) {
      expect(registered).toContain(route);
    }
  });

  it("the checkout return carries the session the order screen reads", () => {
    const pattern = linking.config.screens.App.screens.OrderDetail;
    expect(pattern).toBe("store/order/:sessionId");

    const screen = fs.readFileSync(
      path.resolve(__dirname, "../screens/store/OrderDetailScreen.js"),
      "utf8"
    );
    expect(screen).toMatch(/sessionId/);
  });
});
