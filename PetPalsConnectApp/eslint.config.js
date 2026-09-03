const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["node_modules/", ".expo/", "dist/", "ios/", "android/", "functions/"],
  },
  {
    // Test files and the jest setup run under jest, not the app runtime.
    files: ["**/*.test.{js,jsx,ts,tsx}", "jest.setup.js", "jest.config.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        jest: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        global: "writable",
        require: "readonly",
        module: "writable",
      },
    },
    rules: {
      // Capturing the session into an outer variable is how these tests reach
      // the context's actions. That is a test-harness pattern, not app code.
      "react-hooks/globals": "off",
    },
  },
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

      // The rules below ship as errors in eslint-config-expo 57 and come from
      // the React Compiler's stricter model. They flag genuine quality issues,
      // but the codebase predates them and has ~23 pre-existing violations.
      //
      // They are warnings so `npm run lint` can gate NEW errors today rather
      // than failing on a backlog. Fix a file's warnings when you touch it, and
      // promote each rule back to "error" once its count reaches zero:
      //
      //   set-state-in-effect  - setState called synchronously in an effect.
      //                          The 11 remaining sites are all "fetch on mount,
      //                          then setState". Clearing them properly means
      //                          moving data fetching to a library or Suspense,
      //                          which is a refactor rather than a lint fix.
      "react-hooks/set-state-in-effect": "warn",

      // These two reached zero and are errors again:
      //   immutability - using a value before its declaration
      //   refs         - touching a ref during render
      "react-hooks/immutability": "error",
      "react-hooks/refs": "error",
      "react-hooks/static-components": "error",

      // Advisory, and wrong here: `axios.create` and `tw.style` are the
      // documented call shapes for both libraries.
      "import/no-named-as-default-member": "off",

      // Hook-order violations stay errors: they crash at runtime.
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    // The base rule cannot see TypeScript: it reports every parameter in an
    // interface's method signature as an unused variable. Hand those files to
    // the typescript-eslint version, which understands declarations.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
