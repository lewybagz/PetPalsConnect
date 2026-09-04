const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: [
      "node_modules/",
      ".expo/",
      "dist/",
      // The gallery's web build, and the images it produces.
      "dist-gallery/",
      "screenshots/",
      "ios/",
      "android/",
      "functions/",
    ],
  },
  {
    // Build-time checks that run under Node, not the app runtime or Metro.
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
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
        __dirname: "readonly",
        process: "readonly",
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
    // Reanimated's shared values are mutable boxes by design: `sv.value = x` is
    // the library's entire write API, and the assignment is what crosses to the
    // UI thread. The React Compiler's model sees a value passed to a hook being
    // modified afterwards and flags it, correctly by its own rules and wrongly
    // here - there is no other way to drive an animation with this library.
    //
    // Scoped to the files that hold gestures rather than downgraded globally:
    // the rule reached zero violations everywhere else and is worth keeping as
    // an error there.
    files: ["**/SwipeableCard.js"],
    rules: {
      "react-hooks/immutability": "off",
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
  {
    // `no-undef` is on, but eslint-config-expo loads the browser globals so the
    // app can target web - and the DOM happens to define `Text`, `Image` and
    // `StyleSheet`. Those are three of the most-used React Native names, so
    // forgetting to import one passed lint, bundled cleanly, and threw a
    // ReferenceError the moment the screen was imported on a device. It had
    // taken out HomeScreen (the first screen after sign-in) and
    // ChatDetailsScreen. Undeclaring them here turns that back into a lint
    // error. `document`/`window` stay declared - .web.js files legitimately
    // use them.
    files: ["src/**/*.{js,jsx}", "services/**/*.js", "utils/**/*.js"],
    ignores: ["**/*.web.js", "**/*.web.jsx"],
    languageOptions: {
      globals: { Text: "off", Image: "off", StyleSheet: "off" },
    },
  },
];
