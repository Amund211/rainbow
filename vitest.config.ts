import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
    resolve: {
        alias: { "#": path.resolve(import.meta.dirname, "src") },
    },
    test: {
        includeTaskLocation: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/routeTree.gen.ts"],
        },
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    include: ["src/**/*.unit.test.ts"],
                },
            },
            {
                extends: true,
                plugins: [react()],
                test: {
                    name: "ui",
                    include: ["src/**/*.ui.test.tsx"],
                    setupFiles: ["./src/test/setup.ts"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        // https://vitest.dev/config/browser/playwright
                        // Only run chromium in all environments to keep CI fast
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
        ],
    },
});
