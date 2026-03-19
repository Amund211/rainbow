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
// Note: 'react-hooks' is a reserved name in oxlint (implemented natively as part
// of the 'react' plugin), so eslint-plugin-react-hooks must be aliased. We remap
// the 'react-hooks/' prefix to 'react-hooks-js/' accordingly.
// eslint-plugin-react-hooks v7 recommended-latest includes both core hooks rules
// AND all React Compiler rules (formerly in eslint-plugin-react-compiler).
const reactHooksRecommendedRules: DummyRuleMap = (() => {
    const { rules } = (
        require("eslint-plugin-react-hooks") as {
            configs: {
                flat: {
                    "recommended-latest": {
                        rules: Record<string, string | [string, ...unknown[]]>;
                    };
                };
            };
        }
    ).configs.flat["recommended-latest"];

    if (!rules || Object.keys(rules).length === 0) {
        throw new Error(
            "Failed to extract rules from eslint-plugin-react-hooks " +
                "recommended-latest. The plugin structure may have changed.",
        );
    }

    return Object.fromEntries(
        Object.entries(rules).map(([key, value]) => [
            key.replace("react-hooks/", "react-hooks-js/"),
            value,
        ]),
    ) as DummyRuleMap;
})();

const tanstackQueryRecommendedRules: DummyRuleMap = (() => {
    const configs = (
        require("@tanstack/eslint-plugin-query") as {
            configs: {
                "flat/recommended": Array<{
                    rules?: Record<string, string | [string, ...unknown[]]>;
                }>;
            };
        }
    ).configs["flat/recommended"];

    const rules = Object.fromEntries(
        configs.flatMap((c) => Object.entries(c.rules ?? {})),
    ) as DummyRuleMap;

    if (Object.keys(rules).length === 0) {
        throw new Error(
            "Failed to extract rules from @tanstack/eslint-plugin-query " +
                "flat/recommended. The plugin structure may have changed.",
        );
    }

    return rules;
})();

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
