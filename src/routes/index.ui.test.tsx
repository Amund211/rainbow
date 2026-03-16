import { describe, it, expect, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID, TEST_USERNAME } from "#mocks/data.ts";

describe("Home page", () => {
    it("renders player search input", async () => {
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("contains meta description about Prism Overlay", async () => {
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="Prism Overlay"]'),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("contains canonical link", async () => {
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(
                document.querySelector('link[href="https://prismoverlay.com"]'),
            ).toBeInTheDocument();
        });

        rendered.unmount();
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
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument();
        });

        rendered.unmount();
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
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(
                screen.getByLabelText(`Remove ${TEST_USERNAME} from favorites`),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("does not render favorites section when localStorage is empty", async () => {
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });

        expect(screen.queryByText(TEST_USERNAME)).not.toBeInTheDocument();

        rendered.unmount();
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
        const { rendered } = renderAppRoute("/");

        await waitFor(() => {
            expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument();
        });

        // Find the button via the icon's aria-label, then click its parent IconButton.
        // Using dispatchEvent instead of fireEvent.click because the latter wraps in
        // act() which hangs due to re-renders triggered by removePlayerVisits.
        const deleteButton = screen
            .getByLabelText(`Remove ${TEST_USERNAME} from favorites`)
            .closest("button");
        expect(deleteButton).toBeInTheDocument();
        deleteButton!.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );

        const stored = localStorage.getItem("playerVisits");
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored ?? "{}") as Record<string, unknown>;
        expect(parsed[TEST_UUID]).toBeUndefined();

        rendered.unmount();
    });
});
