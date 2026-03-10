import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID } from "#mocks/data.ts";

describe("History explore page", () => {
    it("renders gamemode and stat select dropdowns", async () => {
        renderAppRoute("/history/explore");
        await waitFor(() => {
            expect(screen.getByLabelText("Gamemodes")).toBeInTheDocument();
        });
        expect(screen.getByLabelText("Stat")).toBeInTheDocument();
    });

    it("renders time filter chips", async () => {
        renderAppRoute("/history/explore");
        await waitFor(() => {
            expect(screen.getByText("Today")).toBeInTheDocument();
        });
        expect(screen.getByText("Yesterday")).toBeInTheDocument();
        expect(screen.getByText("This week")).toBeInTheDocument();
        expect(screen.getByText("Last week")).toBeInTheDocument();
        expect(screen.getByText("This month")).toBeInTheDocument();
        expect(screen.getByText("Last month")).toBeInTheDocument();
        expect(screen.getByText("This year")).toBeInTheDocument();
        expect(screen.getByText("Last year")).toBeInTheDocument();
    });

    it("renders variant toggle group", async () => {
        renderAppRoute("/history/explore");
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Stat chart variant selection",
                }),
            ).toBeInTheDocument();
        });
        // Variant labels: "All time", "Session", "Both" rendered as router links
        expect(screen.getByText("All time")).toBeInTheDocument();
        expect(screen.getByText("Session")).toBeInTheDocument();
        expect(screen.getByText("Both")).toBeInTheDocument();
    });

    it("renders username when player is selected via URL", async () => {
        const start = "2025-06-01T00:00:00.000Z";
        const end = "2025-06-02T00:00:00.000Z";
        renderAppRoute(
            `/history/explore?uuids=%5B%22${TEST_UUID}%22%5D&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&stats=%5B%22fkdr%22%5D&gamemodes=%5B%22overall%22%5D&variantSelection=session&limit=50`,
        );
        await waitFor(
            () => {
                expect(screen.getByText("TestPlayer")).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
    });

    it("renders user multi-select for adding players", async () => {
        renderAppRoute("/history/explore");
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Add players"),
            ).toBeInTheDocument();
        });
    });
});
