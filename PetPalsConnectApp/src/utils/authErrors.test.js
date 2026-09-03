import { describeAuthError, describeApiError } from "./authErrors";

describe("describeAuthError", () => {
  it("maps a known Firebase code to plain language", () => {
    const message = describeAuthError({ code: "auth/email-already-in-use" });
    expect(message).toMatch(/already an account/i);
  });

  it("never leaks a bracketed Firebase code into the UI", () => {
    // Firebase's own message reads "[auth/wrong-password] The password is..."
    const message = describeAuthError({
      code: "auth/wrong-password",
      message: "[auth/wrong-password] The password is invalid.",
    });
    expect(message).not.toContain("[");
    expect(message).not.toContain("auth/");
  });

  it("strips the code prefix from an unmapped error rather than showing it raw", () => {
    const message = describeAuthError({
      code: "auth/some-new-code",
      message: "[auth/some-new-code] Something specific happened.",
    });
    expect(message).toBe("Something specific happened.");
  });

  it("falls back to a generic message when there is nothing useful", () => {
    expect(describeAuthError(null)).toMatch(/something went wrong/i);
    expect(describeAuthError({})).toMatch(/something went wrong/i);
  });

  it("suggests signing in when the email is already taken", () => {
    expect(describeAuthError({ code: "auth/email-already-in-use" })).toMatch(
      /signing in/i
    );
  });

  it("does not reveal whether an account exists on a failed sign-in", () => {
    // Both should read the same, so neither can be used to probe for accounts.
    const wrongPassword = describeAuthError({ code: "auth/wrong-password" });
    const invalidCredential = describeAuthError({ code: "auth/invalid-credential" });
    expect(wrongPassword).toBe(invalidCredential);
  });
});

describe("describeApiError", () => {
  it("shows the API's own message for a client error", () => {
    const message = describeApiError({
      response: { status: 409, data: { message: "That username is taken." } },
    });
    expect(message).toBe("That username is taken.");
  });

  it("hides server-error detail behind a generic message", () => {
    const message = describeApiError({
      response: { status: 500, data: { message: "MongoServerError: E11000 ..." } },
    });
    expect(message).not.toMatch(/Mongo/);
    expect(message).toMatch(/server had a problem/i);
  });

  it("explains a timeout", () => {
    expect(describeApiError({ code: "ECONNABORTED" })).toMatch(/too long/i);
  });

  it("explains being offline when there is no response at all", () => {
    expect(describeApiError({ message: "Network Error" })).toMatch(/connection/i);
  });

  it("handles being called with nothing", () => {
    expect(() => describeApiError(undefined)).not.toThrow();
  });
});
