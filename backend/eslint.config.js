const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^(next|_)" }],
      "no-console": "off",

      // `const service = new service({...})` - referencing the const being
      // declared. A TDZ error on every call, and it happened four times:
      // ReportController, ServiceController, ReviewController and
      // GroupChatController each had one, so filing a report, listing a
      // service, resolving a pet's owner and finding a group chat all threw.
      // The recommended config leaves this off for variables.
      "no-use-before-define": ["error", { variables: true, functions: false }],
    },
  },
  { ignores: ["node_modules/", "coverage/"] },
];
