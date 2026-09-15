import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The two build scripts are plain ESM run by node; TypeScript files get
    // their globals from `lib` in tsconfig, so only these need naming.
    files: ["scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", Buffer: "readonly" },
    },
  }
);
