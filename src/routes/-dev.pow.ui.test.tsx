import { describe, expect } from "vitest";

import { mswTest } from "#test/msw-test.ts";
import { renderAppRoute } from "#test/render.tsx";

describe("Proof-of-work benchmark page", () => {
    mswTest("solves fake challenges and reports the timings", async () => {
        const { screen } = await renderAppRoute("/dev/pow");

        await expect
            .element(screen.getByRole("heading", { name: "Proof-of-work benchmark" }))
            .toBeInTheDocument();

        // Low difficulties: the page under test is the harness, not the work.
        await screen.getByLabelText("Difficulty from").fill("4");
        await screen.getByLabelText("Difficulty to").fill("5");
        await screen.getByLabelText("Runs each").fill("2");

        await screen.getByRole("button", { name: "Run benchmark" }).click();

        await expect.element(screen.getByText("Done.")).toBeInTheDocument();

        // The answer the page exists to give, above the working behind it
        await expect
            .element(
                screen.getByText(
                    /Starts to hurt at difficulty|Nothing up to difficulty/,
                ),
            )
            .toBeInTheDocument();

        await expect
            .element(screen.getByRole("heading", { name: "Measured" }))
            .toBeInTheDocument();
        await expect
            .element(screen.getByRole("heading", { name: "Estimated" }))
            .toBeInTheDocument();

        // Measured, estimated, and the per-run table last.
        const runTable = screen.getByRole("table").all().at(-1);
        // Two difficulties, two runs each, plus the header row.
        await expect.poll(() => runTable?.getByRole("row").all().length).toBe(5);
    });

    mswTest("rejects a range that ends below where it starts", async () => {
        const { screen } = await renderAppRoute("/dev/pow");

        await screen.getByLabelText("Difficulty from").fill("10");
        await screen.getByLabelText("Difficulty to").fill("4");

        await screen.getByRole("button", { name: "Run benchmark" }).click();

        await expect
            .element(
                screen.getByText("The difficulty range ends below where it starts."),
            )
            .toBeInTheDocument();
        await expect
            .element(screen.getByRole("heading", { name: "Measured" }))
            .not.toBeInTheDocument();
    });
});
