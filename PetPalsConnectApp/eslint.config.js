const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["node_modules/", ".expo/", "dist/", "ios/", "android/", "functions/"],
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
      //   set-state-in-effect  - setState called synchronously in an effect
      //                          (cascading renders; usually wants an event
      //                          handler or a derived value instead)
      //   immutability         - reading a value before its declaration
      //   refs                 - touching a ref during render
      //   static-components    - a component defined inside another component's
      //                          render (remounts its whole subtree every render)
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",

      // Hook-order violations stay errors: they crash at runtime.
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
