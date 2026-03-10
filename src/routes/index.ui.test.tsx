import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID, TEST_USERNAME } from "#mocks/data.ts";

describe("Home page", () => {
    beforeEach(() => {
        renderAppRoute("/");
    });

    it("renders player search input", async () => {
        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });
    });

    it("contains meta description about Prism Overlay", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="Prism Overlay"]'),
            ).toBeInTheDocument();
        });
    });

    it("contains canonical link", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('link[href="https://prismoverlay.com"]'),
            ).toBeInTheDocument();
        });
    });
});

describe("Home page with favorites", () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("displays favorites when playerVisits are in localStorage", async () => {
        localStorage.setItem(
            "playerVisits",
            JSON.stringify({
                [TEST_UUID]: {
                    visitedCount: 5,
                    lastVisited: "2025-06-01T00:00:00.000Z",
                },
            }),
        );
        renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument();
        });
    });

    it("renders delete button with correct aria-label", async () => {
        localStorage.setItem(
            "playerVisits",
            JSON.stringify({
                [TEST_UUID]: {
                    visitedCount: 5,
                    lastVisited: "2025-06-01T00:00:00.000Z",
                },
            }),
        );
        renderAppRoute("/");

        await waitFor(() => {
            expect(
                screen.getByLabelText(`Remove ${TEST_USERNAME} from favorites`),
            ).toBeInTheDocument();
        });
    });

    it("does not render favorites section when localStorage is empty", async () => {
        renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });

        expect(screen.queryByText(TEST_USERNAME)).not.toBeInTheDocument();
    });

    it("removes favorite from localStorage when delete button is clicked", async () => {
        localStorage.setItem(
            "playerVisits",
            JSON.stringify({
                [TEST_UUID]: {
                    visitedCount: 5,
                    lastVisited: "2025-06-01T00:00:00.000Z",
                },
            }),
        );
        renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument();
        });

        const deleteButton = document.querySelector(
            `#delete-favorite-${TEST_UUID}`,
        );
        expect(deleteButton).toBeTruthy();

        if (deleteButton) {
            deleteButton.dispatchEvent(
                new MouseEvent("click", { bubbles: true, cancelable: true }),
            );
        }

        const stored = localStorage.getItem("playerVisits");
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored ?? "{}") as Record<string, unknown>;
        expect(parsed[TEST_UUID]).toBeUndefined();
    });
});
