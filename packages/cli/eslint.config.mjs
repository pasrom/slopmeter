import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import stylistic from "@stylistic/eslint-plugin";
import { config } from "@repo/eslint-config/base";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    files: ["src/**/*.ts", "tsup.config.ts"],
    plugins: {
      "@stylistic": stylistic,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      "no-else-return": "error",
      curly: ["error", "all"],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
      ],
    },
  },
];
