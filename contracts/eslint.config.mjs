// @ts-check
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ─── Ignores ───────────────────────────────────────────────────────────────
  {
    ignores: [
      "node_modules/**",
      "artifacts/**",
      "cache/**",
      "deployments/**",
      "typechain-types/**",
    ],
  },

  // ─── Base JS recommended ───────────────────────────────────────────────────
  js.configs.recommended,

  // ─── TypeScript files ──────────────────────────────────────────────────────
  {
    files: ["hardhat.config.ts", "scripts/**/*.ts", "test/**/*.ts"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        globalThis: "readonly",
      },
    },
    rules: {
      // ── TypeScript ────────────────────────────────────────────────────────
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ── General ───────────────────────────────────────────────────────────
      "no-undef": "off", // TypeScript type-checker đã handle undef
      "no-console": "off", // deploy script và logs dùng console
      "no-debugger": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
    },
  },
];
