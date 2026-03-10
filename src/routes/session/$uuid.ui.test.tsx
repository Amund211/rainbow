import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderAppRoute } from "#test/render.tsx";
import { TEST_UUID } from "#mocks/data.ts";

describe("Session detail page", () => {
    it("renders player username in heading", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(
                    screen.getByText("TestPlayer's session stats"),
                ).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
    });

    it("renders gamemode and stat selectors", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(() => {
            expect(screen.getByLabelText("Gamemode")).toBeInTheDocument();
        });
        expect(screen.getByLabelText("Stat")).toBeInTheDocument();
    });

    it("renders variant toggle with All time / Session / Both", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(() => {
            expect(
                screen.getByRole("group", {
                    name: "Stat chart variant selection",
                }),
            ).toBeInTheDocument();
        });
        expect(screen.getByText("All time")).toBeInTheDocument();
        expect(screen.getByText("Session")).toBeInTheDocument();
        expect(screen.getByText("Both")).toBeInTheDocument();
    });

    it("renders session table", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
    });

    it("renders stat progression cards", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(
            () => {
                // Progression card titles include interval type prefix
                expect(screen.getByText(/^Daily /)).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
        expect(screen.getByText(/^Weekly /)).toBeInTheDocument();
        expect(screen.getByText(/^Monthly /)).toBeInTheDocument();
    });

    it("renders player search input for switching players", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(() => {
            expect(
                screen.getByPlaceholderText("Search players"),
            ).toBeInTheDocument();
        });
    });

    it("shows session table mode toggle (total/rate)", async () => {
        renderAppRoute(`/session/${TEST_UUID}`);
        await waitFor(
            () => {
                expect(
                    screen.getByRole("group", {
                        name: "Session table mode",
                    }),
                ).toBeInTheDocument();
            },
            { timeout: 5000 },
        );
    });
});
