import { describe, it, expect, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID, TEST_USERNAME } from "#mocks/data.ts";

describe("Settings page", () => {
    it("renders Default player heading", async () => {
        const { rendered } = renderAppRoute("/settings");

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "Default player" }),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("renders info tooltip about default player", async () => {
        const { rendered } = renderAppRoute("/settings");

        await waitFor(() => {
            expect(screen.getByTestId("InfoOutlinedIcon")).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("renders the user multi-select input", async () => {
        const { rendered } = renderAppRoute("/settings");

        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Set default player"),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("contains meta description about settings", async () => {
        const { rendered } = renderAppRoute("/settings");

        await waitFor(() => {
            expect(
                document.querySelector('meta[content*="settings"]'),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });

    it("contains canonical link with /settings", async () => {
        const { rendered } = renderAppRoute("/settings");

        await waitFor(() => {
            expect(
                document.querySelector(
                    'link[href="https://prismoverlay.com/settings"]',
                ),
            ).toBeInTheDocument();
        });

        rendered.unmount();
    });
});

describe("Settings page with current user", () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("displays username when currentUser is set in localStorage", async () => {
        localStorage.setItem("currentUser", TEST_UUID);
        const { rendered } = renderAppRoute("/settings");

        await waitFor(() => {
            expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument();
        });

        rendered.unmount();
    });
});
