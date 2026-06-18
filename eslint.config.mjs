import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-config-next 16.2 enables opt-in React Compiler rules that
      // produce cascading-setState, static-components, and purity errors
      // across the existing codebase. Disable until codebase is migrated.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Flutter/native artifacts. These can contain vendored JS from
    // mobile SDKs and should not be linted as app source.
    "mobile/.dart_tool/**",
    "mobile/build/**",
    "mobile/android/.gradle/**",
    "mobile/ios/Pods/**",
    "mobile/release/**",
  ]),
]);

export default eslintConfig;
