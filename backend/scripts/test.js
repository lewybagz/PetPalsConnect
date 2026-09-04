#!/usr/bin/env node
/**
 * Runs the test suite against one in-memory MongoDB.
 *
 * Why this exists rather than `node --test` on its own.
 *
 * Every test file calls `harness.start()`, which used to create its own
 * `MongoMemoryServer`. Node runs each file in its own process, so that is
 * eighteen `mongod` spawns per run, and each one picks a random free port and
 * then binds it - a check-then-act with a gap in the middle. Nearly always
 * fine; roughly one run in fifteen, one of the eighteen lost the race and its
 * `before` hook threw. Every test in that file was then reported as failed, so
 * a green suite turned into "10 failures" with no obvious cause, and the next
 * run was green again. Twenty-five runs of any single file in isolation never
 * reproduced it, because the failure rate is per *spawn*, not per file: the
 * whole suite rolls the dice eighteen times.
 *
 * One server for the run means one spawn. The eighteen processes each get their
 * own database on it - named after the test file, so files stay isolated from
 * one another and `--test-concurrency` could be raised again - and the runner
 * owns the server's lifetime, including on Ctrl-C, which is what stops
 * `mongo-mem-*` directories and socket files piling up in /tmp.
 *
 * Process isolation is deliberately kept. Sharing one *process* across files
 * (`--experimental-test-isolation=none`) would also do it, at the cost of every
 * file sharing a module registry and a mongoose instance - trading a flake with
 * a known cause for a class of leak that is much harder to see.
 *
 * `harness.start()` still creates its own server when `MONGO_TEST_URI` is
 * missing, so `node --test test/auth.test.js` continues to work on its own.
 */
const { spawn } = require("node:child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");

const args = process.argv.slice(2);
const files = args.length > 0 ? args : ["test/**/*.test.js"];

const run = async () => {
  const mongod = await MongoMemoryServer.create();
  let stopped = false;

  /** Idempotent: the signal handlers and the normal path both call it. */
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await mongod.stop().catch((error) => {
      console.warn("[test] could not stop mongod:", error.message);
    });
  };

  const child = spawn(
    process.execPath,
    [
      "--test",
      // One at a time. The suite is not slow enough to be worth the risk of
      // eighteen processes sharing one server's connection limit, and a serial
      // run makes a failure's output readable.
      "--test-concurrency=1",
      // `spec` names the failing test and prints its error. The default TAP
      // output buries both, which is how a red run went unexplained.
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      ...files,
    ],
    {
      stdio: "inherit",
      env: { ...process.env, MONGO_TEST_URI: mongod.getUri() },
    }
  );

  const finish = async (code) => {
    await stop();
    process.exit(code);
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
      stop().finally(() => process.exit(1));
    });
  }

  child.on("error", async (error) => {
    console.error("[test] could not start the test runner:", error.message);
    await finish(1);
  });

  child.on("exit", (code, signal) => finish(signal ? 1 : (code ?? 1)));
};

run().catch(async (error) => {
  console.error("[test] could not start an in-memory MongoDB:", error.message);
  process.exit(1);
});
