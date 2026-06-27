import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const eslintConfig = [
  {
    ignores: [".next/**", ".codex-logs/**", "node_modules/**", "out/**", "next-env.d.ts"]
  },
  {
    ...nextPlugin.flatConfig.coreWebVitals,
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      ...nextPlugin.flatConfig.coreWebVitals.plugins,
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin
    }
  },
  {
    rules: {
      "@next/next/no-img-element": "off"
    }
  }
];

export default eslintConfig;
