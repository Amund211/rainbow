import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: {
        alias: { "#": path.resolve(import.meta.dirname, "src") },
    },
    test: {
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
                    include: ["src/**/*.test.ts"],
                },
            },
            {
                extends: true,
                test: {
                    name: "ui",
                    include: ["src/**/*.ui.test.tsx"],
                    environment: "jsdom",
                    setupFiles: ["./src/test/setup.ts"],
                    execArgv: ["--no-webstorage"],
                },
            },
        ],
    },
});
