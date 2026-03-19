import { defineConfig } from "oxlint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Read the installed React version to keep settings.react.version in sync.
// oxlint.config.ts is used instead of .oxlintrc.json to allow dynamic values.
const { version: reactVersion } = require("react/package.json") as {
    version: string;
};

export default defineConfig({
    plugins: ["typescript", "react"],
    jsPlugins: [
        // React Compiler rules (no native oxlint equivalent)
        "eslint-plugin-react-compiler",
        // TanStack Query rules (no native oxlint equivalent)
        "@tanstack/eslint-plugin-query",
    ],
    categories: {
        correctness: "error",
        suspicious: "warn",
    },
    env: {
        browser: true,
    },
    settings: {
        react: {
            version: reactVersion,
        },
    },
    ignorePatterns: ["dist", "src/routeTree.gen.ts"],
    rules: {
        // Not needed with the new JSX transform (React 17+)
        "react/react-in-jsx-scope": "off",
        // React Compiler enforcement via JS plugin
        "react-compiler/react-compiler": "error",
        // TanStack Query recommended rules via JS plugin
        "@tanstack/query/exhaustive-deps": "error",
        "@tanstack/query/no-rest-destructuring": "warn",
        "@tanstack/query/stable-query-client": "error",
        "@tanstack/query/no-unstable-deps": "error",
        "@tanstack/query/infinite-query-property-order": "error",
        "@tanstack/query/no-void-query-fn": "error",
        "@tanstack/query/mutation-property-order": "error",
    },
});
