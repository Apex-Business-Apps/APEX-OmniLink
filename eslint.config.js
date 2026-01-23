import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "tests/contracts/**", "scripts/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "@typescript-eslint/no-explicit-any": ["error", {
        fixToUnknown: true,
        ignoreRestArgs: false
      }],
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-console": ["error", {
        allow: ["warn", "error"]
      }],
    },
  },
  // Relaxed rules for CLI scripts, simulation, and sandbox files
  {
    files: ["sim/**/*.ts", "scripts/**/*.ts", "sandbox/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",  // Allow any in simulation code
    },
  },
  // Allow console.log in monitoring/debugging infrastructure (legacy code)
  // BACKLOG: Migrate to structured logging (tracked in project board)
  {
    files: [
      "src/lib/monitoring.ts",
      "src/lib/offline.ts",
      "src/lib/config.ts",
      "src/lib/lovableConfig.ts",
      "src/lib/security.ts",
      "src/lib/database/providers/supabase.ts",
      "src/lib/storage/providers/supabase.ts",
      "src/integrations/supabase/client.ts",
      "src/omniconnect/**/*.ts",
      "src/pages/**/*.tsx",  // Page components may log for debugging
      "tests/**/*.ts",  // Test files may log
      "supabase/functions/**/*.ts",  // Edge functions may log
    ],
    rules: {
      "no-console": "off",  // Legacy: uses console for debugging
    },
  },
);
