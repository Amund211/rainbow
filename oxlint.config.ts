import { defineConfig } from "oxlint";
import type { DummyRuleMap } from "oxlint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Read the installed React version to keep settings.react.version in sync.
// oxlint.config.ts is used instead of .oxlintrc.json to allow dynamic values.
const { version: reactVersion } = require("react/package.json") as {
    version: string;
};

// Derive rules from plugins' recommended configs so we don't have to maintain
// them manually. New recommended rules are picked up automatically on plugin updates.
//
// Note: 'react-hooks' is a reserved name in oxlint (implemented natively), so
// eslint-plugin-react-hooks must be aliased. We remap the 'react-hooks/' prefix
// to 'react-hooks-js/' accordingly.
// eslint-plugin-react-hooks v7 recommended-latest includes both core hooks rules
// AND all React Compiler rules (formerly in eslint-plugin-react-compiler).
const reactHooksRecommendedRules = Object.fromEntries(
    Object.entries(
        (
            require("eslint-plugin-react-hooks") as {
                configs: {
                    flat: {
                        "recommended-latest": {
                            rules: Record<
                                string,
                                string | [string, ...unknown[]]
                            >;
                        };
                    };
                };
            }
        ).configs.flat["recommended-latest"].rules,
    ).map(([key, value]) => [
        key.replace("react-hooks/", "react-hooks-js/"),
        value,
    ]),
) as DummyRuleMap;

const tanstackQueryRecommendedRules = Object.fromEntries(
    (
        require("@tanstack/eslint-plugin-query") as {
            configs: {
                "flat/recommended": Array<{
                    rules?: Record<string, string | [string, ...unknown[]]>;
                }>;
            };
        }
    ).configs["flat/recommended"].flatMap((c) => Object.entries(c.rules ?? {})),
) as DummyRuleMap;

export default defineConfig({
    plugins: ["typescript", "react"],
    jsPlugins: [
        // 'react-hooks' is reserved in oxlint (native implementation), so we alias.
        // recommended-latest covers core hooks rules + React Compiler rules.
        { name: "react-hooks-js", specifier: "eslint-plugin-react-hooks" },
        // TanStack Query rules (no native oxlint equivalent).
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
        // Rules derived from plugin recommended configs (spread above). The rules
        // section below contains only overrides to the defaults above.
        ...reactHooksRecommendedRules,
        ...tanstackQueryRecommendedRules,
        // Not needed with the new JSX transform (React 17+).
        "react/react-in-jsx-scope": "off",
        // Native oxlint already covers exhaustive-deps (as react/exhaustive-deps)
        // via the correctness category. Disable the JS plugin duplicate to avoid
        // reporting the same violation twice.
        "react-hooks-js/exhaustive-deps": "off",
    },
});
