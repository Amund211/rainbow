import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { expectVariantToggle } from "#test/assertions.ts";
import { TEST_UUID } from "#mocks/data.ts";

describe("Session detail page", () => {
    beforeEach(() => {
        renderAppRoute(`/session/${TEST_UUID}`);
    });

    it("renders player username in heading", async () => {
        await waitFor(() => {
            expect(
                screen.getByText("TestPlayer's session stats"),
            ).toBeInTheDocument();
        });
    });

    it("renders gamemode and stat selectors", async () => {
        await waitFor(() => {
            expect(screen.getByLabelText("Gamemode")).toBeInTheDocument();
        });
        expect(screen.getByLabelText("Stat")).toBeInTheDocument();
    });

    it("renders variant toggle with All time / Session / Both", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Stat chart variant selection",
                }),
            ).toBeInTheDocument();
        });
        expectVariantToggle();
    });

    it("renders session table", async () => {
        await waitFor(() => {
            expect(screen.getByRole("table")).toBeInTheDocument();
        });
    });

    it("renders stat progression cards", async () => {
        await waitFor(() => {
            // Progression card titles include interval type prefix
            expect(screen.getByText(/^Daily /)).toBeInTheDocument();
        });
        expect(screen.getByText(/^Weekly /)).toBeInTheDocument();
        expect(screen.getByText(/^Monthly /)).toBeInTheDocument();
    });

    it("renders player search input for switching players", async () => {
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });
    });

    it("shows session table mode toggle (total/rate)", async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Session table mode",
                }),
            ).toBeInTheDocument();
        });
    });

    it("renders history charts", async () => {
        await waitFor(() => {
            expect(
                document.querySelector(".recharts-responsive-container"),
            ).toBeInTheDocument();
        });
    });
});
