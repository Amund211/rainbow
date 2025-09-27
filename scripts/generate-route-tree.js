#!/usr/bin/env node

import { Generator } from "@tanstack/router-generator";
import { getConfig } from "@tanstack/router-plugin";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateRouteTree() {
    try {
        const root = path.resolve(__dirname, "..");

        // Use the same config as defined in vite.config.ts
        const config = getConfig({
            addExtensions: true,
            autoCodeSplitting: true,
            routesDirectory: path.join(root, "src", "routes"),
            generatedRouteTree: path.join(root, "src", "routeTree.gen.ts"),
        });

        const generator = new Generator({
            config,
            root,
        });

        await generator.run();
        console.log("Route tree generation completed successfully!");
    } catch (error) {
        console.error("Error generating route tree:", error);
        process.exit(1);
    }
}

generateRouteTree();
