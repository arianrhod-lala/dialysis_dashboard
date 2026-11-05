import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      ".venv/**",
      ".desloppify/**",
      ".agents/**",
      ".codex/**",
      ".vscode/**",
    ],
  },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ["script.js", "tests/browser.spec.js"],
    languageOptions: { globals: globals.browser },
  },
];
