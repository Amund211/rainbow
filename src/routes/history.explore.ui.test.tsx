import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { expectVariantToggle } from "#test/assertions.ts";
import { TEST_UUID } from "#mocks/data.ts";

const PLAYER_URL_BASE = `/history/explore?uuids=%5B%22${TEST_UUID}%22%5D&start=${encodeURIComponent("2025-06-01T00:00:00.000Z")}&end=${encodeURIComponent("2025-06-02T00:00:00.000Z")}&stats=%5B%22fkdr%22%5D&gamemodes=%5B%22overall%22%5D&variantSelection=session&limit=50`;

describe("History explore page", () => {
    beforeEach(() => {
        renderAppRoute("/history/explore");
    });

    it("renders gamemode and stat select dropdowns", async () => {
        await waitFor(() => {
            expect(screen.getByLabelText("Gamemodes")).toBeInTheDocument();
        });
        expect(screen.getByLabelText("Stat")).toBeInTheDocument();
    });

    it("renders time filter chips", async () => {
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
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Stat chart variant selection",
                }),
            ).toBeInTheDocument();
        });
        expectVariantToggle();
    });

    it("renders user multi-select for adding players", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Add players"),
            ).toBeInTheDocument();
        });
    });

    it("renders Start and End date pickers", async () => {
        await waitFor(() => {
            expect(screen.getAllByText("Start").length).toBeGreaterThanOrEqual(
                1,
            );
        });
        expect(screen.getAllByText("End").length).toBeGreaterThanOrEqual(1);
    });

    it("renders meta description with compare text", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="Compare the stats"]'),
            ).toBeInTheDocument();
        });
    });

    it("renders canonical link", async () => {
        await waitFor(() => {
            expect(
                document.querySelector(
                    'link[href="https://prismoverlay.com/history/explore"]',
                ),
            ).toBeInTheDocument();
        });
    });

    it("disables the go-to-session-page button when no player is selected", async () => {
        await waitFor(() => {
            expect(screen.getByLabelText("Gamemodes")).toBeInTheDocument();
        });
        const button = document.querySelector(
            '[aria-labelledby="go-to-session-page-tooltip"]',
        );
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });
});

describe("History explore page with player selected via URL", () => {
    it("renders username", async () => {
        renderAppRoute(PLAYER_URL_BASE);
        await waitFor(() => {
            expect(screen.getByText("TestPlayer")).toBeInTheDocument();
        });
    });

    it("renders a chart when a player is selected", async () => {
        renderAppRoute(PLAYER_URL_BASE);
        await waitFor(() => {
            expect(
                document.querySelector(".recharts-responsive-container"),
            ).toBeInTheDocument();
        });
    });

    it("enables the go-to-session-page button with single player, stat, and gamemode", async () => {
        renderAppRoute(PLAYER_URL_BASE);
        await waitFor(() => {
            expect(screen.getByText("TestPlayer")).toBeInTheDocument();
        });
        const button = document.querySelector(
            '[aria-labelledby="go-to-session-page-tooltip"]',
        );
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
    });
});
