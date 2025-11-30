const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Allow port to be configured via environment variable
const PORT = process.env.VITE_PORT || "5173";
const URL = `http://localhost:${PORT}`;

(async () => {
    try {
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        console.log(`Navigating to ${URL}...`);
        await page.goto(URL, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        console.log("Setting rainbow_user_id in localStorage...");
        await page.evaluate(() => {
            localStorage.setItem(
                "rainbow_user_id",
                "rnb_copilot_coding_agent",
            );
        });

        // Verify it was set
        const userId = await page.evaluate(() => {
            return localStorage.getItem("rainbow_user_id");
        });

        if (userId !== "rnb_copilot_coding_agent") {
            throw new Error(
                `Failed to set rainbow_user_id. Expected 'rnb_copilot_coding_agent', got '${userId}'`,
            );
        }

        console.log(`✓ Successfully set rainbow_user_id to: ${userId}`);

        // Save the storage state for Copilot Playwright to use
        const storageState = await context.storageState();
        const storageStatePath = path.join(
            __dirname,
            "../../.playwright/state.json",
        );

        // Create directory if it doesn't exist
        const dir = path.dirname(storageStatePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            storageStatePath,
            JSON.stringify(storageState, null, 2),
        );
        console.log(`✓ Saved browser state to: ${storageStatePath}`);

        await browser.close();
        console.log("✓ Setup complete");
        process.exit(0);
    } catch (error) {
        console.error("✗ Error during setup:", error.message);
        process.exit(1);
    }
})();

