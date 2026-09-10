const { expo } = require("../app.json");

/**
 * The parts of `app.json` a device build needs and nothing else checks.
 *
 * A capability that is used in code but not declared here fails on a phone
 * and nowhere else: `expo export` resolves imports, jest mocks the native
 * module, and the missing entitlement only shows up when a reviewer taps the
 * button. So the declarations the code depends on are asserted alongside the
 * code that depends on them.
 */
describe("app.json", () => {
  it("declares Sign in with Apple, which the auth screens offer", () => {
    expect(expo.ios.usesAppleSignIn).toBe(true);
  });

  it("uses one bundle id on both platforms", () => {
    expect(expo.ios.bundleIdentifier).toBe(expo.android.package);
  });
});
