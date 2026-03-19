import { defineConfig } from "oxlint";
import { createRequire } from "node:module";
import { oxlintBaseConfig } from "./oxlint.config.base.js";

const require = createRequire(import.meta.url);

// Read the installed React version to keep settings.react.version in sync.
// oxlint.config.ts (TypeScript config) is the recommended approach for dynamic
// values since .oxlintrc.json does not support automatic version detection.
const { version: reactVersion } = require("react/package.json") as {
    version: string;
};

export default defineConfig({
    ...oxlintBaseConfig,
    env: {
        browser: true,
        builtin: true,
    },
    settings: {
        react: {
            version: reactVersion,
        },
    },
});
