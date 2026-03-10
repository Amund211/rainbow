import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID, TEST_USERNAME } from "#mocks/data.ts";

describe("Settings page", () => {
    beforeEach(() => {
        renderAppRoute("/settings");
    });

    it("renders Default player heading", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Default player" }),
            ).toBeInTheDocument();
        });
    });

    it("renders info tooltip about default player", async () => {
        await waitFor(() => {
            expect(screen.getByTestId("InfoOutlinedIcon")).toBeInTheDocument();
        });
    });

    it("renders the user multi-select input", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Set default player"),
            ).toBeInTheDocument();
        });
    });

    it("contains meta description about settings", async () => {
        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="settings"]'),
            ).toBeInTheDocument();
        });
    });

    it("contains canonical link with /settings", async () => {
        await waitFor(() => {
            expect(
                document.querySelector(
                    'link[href="https://prismoverlay.com/settings"]',
                ),
            ).toBeInTheDocument();
        });
    });
});

describe("Settings page with current user", () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("displays username when currentUser is set in localStorage", async () => {
        localStorage.setItem("currentUser", TEST_UUID);
        renderAppRoute("/settings");

        await waitFor(() => {
            expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument();
        });
    });
});
