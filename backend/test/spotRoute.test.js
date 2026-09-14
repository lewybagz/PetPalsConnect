const test = require("node:test");
const assert = require("node:assert/strict");

const { modelFor } = require("../services/spot/route");
const { DEFAULT_MODEL } = require("../services/spot/client");

/**
 * The router is a word list that errs towards the default model. Unset, it
 * is inert; set, a turn goes light only when nothing about it hints at
 * health, poison, an emergency or a write.
 */

const LIGHT = "claude-sonnet-5";

const withLight = (fn) => {
  const before = { light: process.env.SPOT_MODEL_LIGHT, model: process.env.SPOT_MODEL };
  process.env.SPOT_MODEL_LIGHT = LIGHT;
  delete process.env.SPOT_MODEL;
  try {
    fn();
  } finally {
    if (before.light === undefined) delete process.env.SPOT_MODEL_LIGHT;
    else process.env.SPOT_MODEL_LIGHT = before.light;
    if (before.model !== undefined) process.env.SPOT_MODEL = before.model;
  }
};

test("unset, every turn runs on the default model", () => {
  delete process.env.SPOT_MODEL_LIGHT;
  assert.equal(modelFor({ text: "what is the capital of France" }), DEFAULT_MODEL);
  assert.equal(modelFor({ text: "when is my next playdate" }), DEFAULT_MODEL);
});

test("set, a plain question goes light and anything that smells of health, poison or a write does not", () => {
  withLight(() => {
    assert.equal(modelFor({ text: "when is my next playdate?" }), LIGHT);
    assert.equal(modelFor({ text: "who are my pals" }), LIGHT);
    assert.equal(modelFor({ text: "what does the app's premium include" }), LIGHT);

    for (const text of [
      "she has been vomiting since this morning",
      "how much chocolate is too much",
      "what dose of ibuprofen can I give",
      "my dog ate a grape",
      "is this plant safe for cats",
      "her ear looks red",
      "emergency numbers",
      "how much should Bella weigh",
      "what food should I buy",
      "is Bella due for her shots",
    ]) {
      assert.equal(modelFor({ text }), DEFAULT_MODEL, `health: ${text}`);
    }
    for (const text of [
      "log Bella at 42 pounds",
      "remember that Bella hates storms",
      "accept the playdate from sam",
      "cancel Saturday",
      "update her breed to beagle mix",
      "add a kitten called Miso",
      "send a message to support",
      "plan a playdate with Max",
    ]) {
      assert.equal(modelFor({ text }), DEFAULT_MODEL, `write: ${text}`);
    }
  });
});

test("a photo is never light, and a thread that has run heavy stays heavy", () => {
  withLight(() => {
    assert.equal(modelFor({ text: "what is this?", image: true }), DEFAULT_MODEL);
    assert.equal(modelFor({ text: "and the park?", historyModels: [DEFAULT_MODEL] }), DEFAULT_MODEL);
    assert.equal(modelFor({ text: "and the park?", historyModels: [LIGHT] }), LIGHT);
  });
});

test("a light model equal to the default is the same as unset", () => {
  const before = process.env.SPOT_MODEL_LIGHT;
  process.env.SPOT_MODEL_LIGHT = DEFAULT_MODEL;
  try {
    assert.equal(modelFor({ text: "when is my next playdate?" }), DEFAULT_MODEL);
  } finally {
    if (before === undefined) delete process.env.SPOT_MODEL_LIGHT;
    else process.env.SPOT_MODEL_LIGHT = before;
  }
});
